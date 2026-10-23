package com.curiolab.episode

import java.nio.file.Files

object WalkingSkeleton {
    @JvmStatic
    fun main(args: Array<String>) {
        val session = ManualEpisodeSession()
        session.acknowledgeSafety(
            adultConsent = true,
            safetyInstructionsAccepted = true,
            smallObjectSupervisionConfirmed = true,
            expectedSequence = 0
        )
        session.commitPrediction(Trial.FLAT, "folded", 1)
        session.markStop(Trial.FLAT, 5, 2)
        session.confirmStoppedMeasurement(Trial.FLAT, 4, 3)

        val directory = Files.createTempDirectory("curiolab-walking-")
        val path = directory.resolve("manual-episode.snapshot")
        try {
            val store = ManualEpisodeFileStore(path)
            store.save(session.snapshot)
            val resumed = ManualEpisodeSession(ManualEpisodeFileStore(path).load())
            resumed.commitPrediction(Trial.FOLDED, "more", 4)
            resumed.markStop(Trial.FOLDED, 7, 5)
            resumed.confirmStoppedMeasurement(Trial.FOLDED, 7, 6)
            resumed.acknowledgeComparison(7)
            resumed.commitReflection("shape_can_matter", 8)
            store.save(resumed.snapshot)
            val completed = ManualEpisodeSession(ManualEpisodeFileStore(path).load())
            val summary = completed.measuredSummary()
            println(
                """
                {
                  "mode": "FIXTURE MANUAL PATH ONLY — no Fire TV, companion, camera, relay, or AWS connection",
                  "stage": "${completed.snapshot.stage.name.lowercase()}",
                  "camera_mode": "${completed.snapshot.cameraMode}",
                  "flat_stopped_count": ${completed.snapshot.stoppedMeasurements.getValue(Trial.FLAT).lastStableCount},
                  "flat_load": ${summary.flatLoad},
                  "folded_load": ${summary.foldedLoad},
                  "comparison": "${summary.comparison.name.lowercase()}",
                  "branch_node_id": "${summary.branchNodeId}",
                  "state_sequence": ${completed.snapshot.sequence},
                  "snapshot_resume_exercised": true,
                  "file_snapshot_reopen_exercised": true,
                  "notice": "Atomic fixture-file reopen only; no power-loss durability, encrypted production storage, physical experiment, rendered scene, or learning outcome is claimed."
                }
                """.trimIndent()
            )
        } finally {
            Files.deleteIfExists(path)
            Files.deleteIfExists(directory)
        }
    }
}
