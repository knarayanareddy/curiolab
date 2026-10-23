package com.curiolab.episode

import java.nio.file.Files

object EpisodeEngineTestSuite {
    private var passed = 0

    private fun expect(name: String, block: () -> Unit) {
        block()
        passed += 1
        println("PASS $name")
    }

    private fun stateWithBothPredictions(): EpisodeState = EpisodeState()
        .commitPrediction(Trial.FLAT.predictionKey, "unsure", 0)
        .commitPrediction(Trial.FOLDED.predictionKey, "unsure", 1)

    private fun manualFlatConfirmed(): ManualEpisodeSession {
        val session = ManualEpisodeSession()
        session.acknowledgeSafety(true, true, true, 0)
        session.commitPrediction(Trial.FLAT, "folded", 1)
        session.markStop(Trial.FLAT, 5, 2)
        session.confirmStoppedMeasurement(Trial.FLAT, 4, 3)
        return session
    }

    @JvmStatic
    fun main(args: Array<String>) {
        expect("measurement requires a prior prediction") {
            val failed = runCatching { EpisodeState().confirmMeasurement(Trial.FLAT, 3, 0) }
            check(failed.isFailure)
        }
        expect("duplicate prediction is idempotent") {
            val once = EpisodeState().commitPrediction(Trial.FLAT.predictionKey, "flat", 0)
            check(once.commitPrediction(Trial.FLAT.predictionKey, "flat", 0) == once)
            check(runCatching { once.commitPrediction(Trial.FLAT.predictionKey, "folded", 1) }.isFailure)
        }
        expect("adult-confirmed correction drives exact scene value") {
            val state = stateWithBothPredictions().confirmMeasurement(Trial.FLAT, 4, 2)
            check(state.flatResultSceneParameters()["load_count"] == 4)
        }
        expect("greater branch uses confirmed values") {
            val state = stateWithBothPredictions()
                .confirmMeasurement(Trial.FLAT, 3, 2)
                .confirmMeasurement(Trial.FOLDED, 7, 3)
            check(state.comparison() == ComparisonResult.GREATER)
            check(state.measuredSummary().flatLoad == 3)
            check(state.measuredSummary().foldedLoad == 7)
        }
        expect("equal branch is deterministic") {
            val state = stateWithBothPredictions()
                .confirmMeasurement(Trial.FLAT, 4, 2)
                .confirmMeasurement(Trial.FOLDED, 4, 3)
            check(state.comparison() == ComparisonResult.EQUAL)
        }
        expect("lower branch is deterministic") {
            val state = stateWithBothPredictions()
                .confirmMeasurement(Trial.FLAT, 6, 2)
                .confirmMeasurement(Trial.FOLDED, 2, 3)
            check(state.comparison() == ComparisonResult.LOWER)
        }
        expect("duplicate confirmation creates no second transition") {
            val state = stateWithBothPredictions().confirmMeasurement(Trial.FLAT, 4, 2)
            val duplicate = state.confirmMeasurement(Trial.FLAT, 4, 2)
            check(duplicate == state)
            check(duplicate.stateSequence == 3L)
            check(runCatching { state.confirmMeasurement(Trial.FLAT, 5, 3) }.isFailure)
        }
        expect("stale and out-of-range confirmations fail") {
            val state = stateWithBothPredictions()
            check(runCatching { state.confirmMeasurement(Trial.FLAT, 4, 1) }.isFailure)
            check(runCatching { state.confirmMeasurement(Trial.FLAT, 101, 2) }.isFailure)
        }
        expect("summary cannot bypass committed prerequisites") {
            check(runCatching { EpisodeState().measuredSummary() }.isFailure)
            check(runCatching { stateWithBothPredictions().measuredSummary() }.isFailure)
        }
        expect("resumed committed state does not replay completion") {
            val committed = stateWithBothPredictions()
                .confirmMeasurement(Trial.FLAT, 0, 2)
                .confirmMeasurement(Trial.FOLDED, 100, 3)
            val resumed = committed.copy()
            check(resumed.measuredSummary() == committed.measuredSummary())
            check(resumed.confirmMeasurement(Trial.FOLDED, 100, 3) == resumed)
        }
        expect("manual consent stop and correction gate the exact scene value") {
            val session = ManualEpisodeSession()
            session.acknowledgeSafety(false, true, true, 0)
            check(session.snapshot.stage == ManualStage.SAFETY_AND_CONSENT)
            check(runCatching { session.commitPrediction(Trial.FLAT, "folded", 0) }.isFailure)
            session.acknowledgeSafety(true, true, true, 0)
            session.commitPrediction(Trial.FLAT, "folded", 1)
            check(runCatching { session.flatResultSceneParameters() }.isFailure)
            check(runCatching { session.confirmStoppedMeasurement(Trial.FLAT, 4, 2) }.isFailure)
            session.markStop(Trial.FLAT, 5, 2)
            session.confirmStoppedMeasurement(Trial.FLAT, 4, 3)
            check(session.flatResultSceneParameters()["load_count"] == 4)
            check(session.snapshot.stoppedMeasurements.getValue(Trial.FLAT).lastStableCount == 5)
        }
        expect("manual snapshot resumes and completes with measured reflection") {
            val resumed = ManualEpisodeSession(manualFlatConfirmed().snapshot)
            check(resumed.snapshot.stage == ManualStage.FOLDED_PREDICTION)
            resumed.commitPrediction(Trial.FOLDED, "more", 4)
            resumed.markStop(Trial.FOLDED, 2, 5)
            resumed.confirmStoppedMeasurement(Trial.FOLDED, 2, 6)
            resumed.acknowledgeComparison(7)
            resumed.commitReflection("shape_can_matter", 8)
            val summary = resumed.measuredSummary()
            check(summary.flatLoad == 4 && summary.foldedLoad == 2)
            check(summary.comparison == ComparisonResult.LOWER)
            check(summary.foldedPredictionMatched == false)
            check(summary.variableChangePrompt.contains("one comparison"))
            check(resumed.snapshot.sequence == 9L)
        }
        expect("manual duplicate stop and confirmation are idempotent") {
            val session = ManualEpisodeSession()
            session.acknowledgeSafety(true, true, true, 0)
            session.commitPrediction(Trial.FLAT, "same", 1)
            session.markStop(Trial.FLAT, 3, 2)
            val stopped = session.snapshot
            check(session.markStop(Trial.FLAT, 3, 2) == stopped)
            check(runCatching { session.markStop(Trial.FLAT, 4, 3) }.isFailure)
            session.confirmStoppedMeasurement(Trial.FLAT, 3, 3)
            val confirmed = session.snapshot
            check(session.confirmStoppedMeasurement(Trial.FLAT, 3, 3) == confirmed)
        }
        expect("manual stale sequences and out-of-range counts fail") {
            val session = manualFlatConfirmed()
            check(runCatching { session.commitPrediction(Trial.FOLDED, "more", 3) }.isFailure)
            session.commitPrediction(Trial.FOLDED, "more", 4)
            check(runCatching { session.markStop(Trial.FOLDED, 31, 5) }.isFailure)
            session.markStop(Trial.FOLDED, 7, 5)
            check(runCatching { session.confirmStoppedMeasurement(Trial.FOLDED, 7, 4) }.isFailure)
            check(runCatching { session.acknowledgeComparison(6) }.isFailure)
        }
        expect("manual summary requires the completed reflection") {
            check(runCatching { manualFlatConfirmed().measuredSummary() }.isFailure)
        }
        expect("atomic fixture file reopens through a new store and session") {
            val directory = Files.createTempDirectory("curiolab-episode-test-")
            val path = directory.resolve("episode.snapshot")
            try {
                val store = ManualEpisodeFileStore(path)
                val session = manualFlatConfirmed()
                store.save(session.snapshot)
                val firstBytes = Files.readAllBytes(path)
                store.save(session.snapshot)
                check(Files.readAllBytes(path).contentEquals(firstBytes))

                val resumed = ManualEpisodeSession(ManualEpisodeFileStore(path).load())
                check(resumed.snapshot == session.snapshot)
                resumed.commitPrediction(Trial.FOLDED, "more", 4)
                resumed.markStop(Trial.FOLDED, 2, 5)
                resumed.confirmStoppedMeasurement(Trial.FOLDED, 2, 6)
                resumed.acknowledgeComparison(7)
                resumed.commitReflection("shape_can_matter", 8)
                store.save(resumed.snapshot)

                val completed = ManualEpisodeSession(ManualEpisodeFileStore(path).load())
                check(completed.snapshot.stage == ManualStage.COMPLETE)
                check(completed.measuredSummary() == resumed.measuredSummary())
                check(Files.list(directory).use { it.count() } == 1L)
            } finally {
                Files.deleteIfExists(path)
                Files.deleteIfExists(directory)
            }
        }
        expect("malformed or semantically invalid fixture snapshots fail closed") {
            val directory = Files.createTempDirectory("curiolab-snapshot-validation-")
            val path = directory.resolve("episode.snapshot")
            try {
                val store = ManualEpisodeFileStore(path)
                store.save(manualFlatConfirmed().snapshot)
                val valid = Files.readAllBytes(path)
                val invalidMagic = valid.copyOf()
                invalidMagic[0] = 'X'.code.toByte()
                Files.write(path, invalidMagic)
                check(runCatching { store.load() }.isFailure)

                Files.write(path, valid.copyOf(valid.size - 1))
                check(runCatching { store.load() }.isFailure)
                Files.write(path, valid + 0)
                check(runCatching { store.load() }.isFailure)
                val invalidChecksum = valid.copyOf()
                invalidChecksum[invalidChecksum.lastIndex] =
                    (invalidChecksum.last().toInt() xor 1).toByte()
                Files.write(path, invalidChecksum)
                check(runCatching { store.load() }.isFailure)
                val unsupportedVersion = valid.copyOf()
                unsupportedVersion[11] = 2
                Files.write(path, unsupportedVersion)
                check(runCatching { store.load() }.isFailure)

                Files.write(path, valid)
                val invalidState = manualFlatConfirmed().snapshot.copy(
                    stage = ManualStage.COMPLETE,
                    reflection = null
                )
                check(runCatching { store.save(invalidState) }.isFailure)
                check(Files.readAllBytes(path).contentEquals(valid))
            } finally {
                Files.deleteIfExists(path)
                Files.deleteIfExists(directory)
            }
        }
        println("PASS $passed Kotlin episode-engine tests")
    }
}
