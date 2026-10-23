package com.curiolab.episode

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.IOException
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.security.MessageDigest

private const val MAX_SNAPSHOT_STRING_BYTES = 16_384

/**
 * Versioned, value-only fixture snapshots. Atomic replacement prevents torn files;
 * this is not an encrypted production store or a power-loss durability claim.
 */
class ManualEpisodeFileStore(private val path: Path) {
    fun save(snapshot: ManualEpisodeSnapshot) {
        ManualEpisodeSession(snapshot)
        val payload = ByteArrayOutputStream()
        DataOutputStream(payload).use { output ->
            output.writeString(snapshot.stage.name)
            output.writeLong(snapshot.sequence)
            output.writeString(snapshot.cameraMode)
            output.writeString(snapshot.accessibilityMode)
            output.writeNullableString(snapshot.reflection)
            output.writeLong(snapshot.episode.stateSequence)
            output.writeInt(snapshot.episode.predictions.size)
            snapshot.episode.predictions.toSortedMap().forEach { (key, value) ->
                output.writeString(key)
                output.writeString(value)
            }
            output.writeInt(snapshot.episode.measurements.size)
            snapshot.episode.measurements.toSortedMap().forEach { (key, value) ->
                output.writeString(key)
                output.writeInt(value)
            }
            output.writeInt(snapshot.stoppedMeasurements.size)
            snapshot.stoppedMeasurements.toSortedMap().forEach { (trial, measurement) ->
                output.writeString(trial.name)
                output.writeInt(measurement.lastStableCount)
            }
        }
        atomicReplace(envelope(payload.toByteArray()))
    }

    fun load(): ManualEpisodeSnapshot {
        val size = Files.size(path)
        if (size > MAX_SNAPSHOT_BYTES) throw IOException("Snapshot exceeds the fixture size limit")
        val bytes = Files.readAllBytes(path)
        val payload = DataInputStream(ByteArrayInputStream(bytes)).use { input ->
            val magic = ByteArray(MAGIC.size)
            input.readFully(magic)
            if (!magic.contentEquals(MAGIC)) throw IOException("Snapshot magic is invalid")
            val version = input.readInt()
            if (version != FORMAT_VERSION) throw IOException("Snapshot format version is unsupported")
            val payloadSize = input.readInt()
            if (payloadSize < 0 || payloadSize > MAX_SNAPSHOT_BYTES) {
                throw IOException("Snapshot payload length is invalid")
            }
            val expectedDigest = ByteArray(DIGEST_BYTES)
            input.readFully(expectedDigest)
            val value = input.readNBytes(payloadSize)
            if (value.size != payloadSize || input.available() != 0) {
                throw IOException("Snapshot is truncated or has trailing bytes")
            }
            val actualDigest = MessageDigest.getInstance("SHA-256").digest(value)
            if (!MessageDigest.isEqual(expectedDigest, actualDigest)) {
                throw IOException("Snapshot checksum is invalid")
            }
            value
        }
        val snapshot = DataInputStream(ByteArrayInputStream(payload)).use { input ->
            val stage = input.readEnum<ManualStage>()
            val sequence = input.readLong()
            val cameraMode = input.readString()
            val accessibilityMode = input.readString()
            val reflection = input.readNullableString()
            val episodeSequence = input.readLong()
            val predictions = input.readCount("predictions", Trial.entries.size).let { count ->
                buildMap {
                    repeat(count) {
                        val key = input.readString()
                        val value = input.readString()
                        if (put(key, value) != null) throw IOException("Duplicate prediction key")
                    }
                }
            }
            val measurements = input.readCount("measurements", Trial.entries.size).let { count ->
                buildMap {
                    repeat(count) {
                        val key = input.readString()
                        val value = input.readInt()
                        if (put(key, value) != null) throw IOException("Duplicate measurement key")
                    }
                }
            }
            val stopped = input.readCount("stopped measurements", Trial.entries.size).let { count ->
                buildMap {
                    repeat(count) {
                        val trial = input.readEnum<Trial>()
                        val value = StoppedMeasurement(trial, input.readInt())
                        if (put(trial, value) != null) throw IOException("Duplicate stopped measurement")
                    }
                }
            }
            if (input.available() != 0) throw IOException("Snapshot payload has trailing bytes")
            ManualEpisodeSnapshot(
                stage = stage,
                episode = EpisodeState(predictions, measurements, episodeSequence),
                stoppedMeasurements = stopped,
                reflection = reflection,
                sequence = sequence,
                cameraMode = cameraMode,
                accessibilityMode = accessibilityMode
            )
        }
        ManualEpisodeSession(snapshot)
        return snapshot
    }

    private fun envelope(payload: ByteArray): ByteArray {
        val output = ByteArrayOutputStream()
        DataOutputStream(output).use { stream ->
            stream.write(MAGIC)
            stream.writeInt(FORMAT_VERSION)
            stream.writeInt(payload.size)
            stream.write(MessageDigest.getInstance("SHA-256").digest(payload))
            stream.write(payload)
        }
        return output.toByteArray()
    }

    private fun atomicReplace(bytes: ByteArray) {
        val absolute = path.toAbsolutePath()
        val parent = absolute.parent ?: throw IOException("Snapshot must have a parent directory")
        Files.createDirectories(parent)
        val temporary = Files.createTempFile(parent, ".${absolute.fileName}-", ".tmp")
        try {
            Files.write(temporary, bytes)
            try {
                Files.move(
                    temporary,
                    absolute,
                    StandardCopyOption.ATOMIC_MOVE,
                    StandardCopyOption.REPLACE_EXISTING
                )
            } catch (error: AtomicMoveNotSupportedException) {
                throw IOException("Atomic snapshot replacement is unavailable", error)
            }
        } finally {
            Files.deleteIfExists(temporary)
        }
    }

    private companion object {
        val MAGIC = "CURIOEP1".toByteArray(Charsets.UTF_8)
        const val FORMAT_VERSION = 1
        const val DIGEST_BYTES = 32
        const val MAX_SNAPSHOT_BYTES = 1_048_576
    }
}

private fun DataOutputStream.writeString(value: String) {
    val bytes = value.toByteArray(Charsets.UTF_8)
    require(bytes.size <= MAX_SNAPSHOT_STRING_BYTES) { "Snapshot string exceeds the fixture limit" }
    writeInt(bytes.size)
    write(bytes)
}

private fun DataOutputStream.writeNullableString(value: String?) {
    writeBoolean(value != null)
    if (value != null) writeString(value)
}

private fun DataInputStream.readString(): String {
    val size = readInt()
    if (size < 0 || size > MAX_SNAPSHOT_STRING_BYTES) throw IOException("Snapshot string length is invalid")
    val bytes = readNBytes(size)
    if (bytes.size != size) throw IOException("Snapshot string is truncated")
    return String(bytes, Charsets.UTF_8)
}

private fun DataInputStream.readNullableString(): String? =
    if (readBoolean()) readString() else null

private fun DataInputStream.readCount(label: String, maximum: Int): Int {
    val count = readInt()
    if (count < 0 || count > maximum) throw IOException("Snapshot $label count is invalid")
    return count
}

private inline fun <reified T : Enum<T>> DataInputStream.readEnum(): T {
    val value = readString()
    return runCatching { enumValueOf<T>(value) }.getOrElse {
        throw IOException("Snapshot enum value is invalid", it)
    }
}
