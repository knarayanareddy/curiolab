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
        expect("remote directional/select/back intents ignore system voice and repeated activation") {
            check(remoteIntent(19, true) == RemoteIntent.UP)
            check(remoteIntent(20, true) == RemoteIntent.DOWN)
            check(remoteIntent(21, true) == RemoteIntent.LEFT)
            check(remoteIntent(22, true) == RemoteIntent.RIGHT)
            check(remoteIntent(23, true) == RemoteIntent.SELECT)
            check(remoteIntent(4, true) == RemoteIntent.BACK)
            check(remoteIntent(23, true, 1) == null)
            check(remoteIntent(19, false) == null)
            check(remoteIntent(231, true) == null)
        }
        expect("voice maps only exact current-node synonyms with final confident scoped push to talk") {
            val voice = VoiceTranscript("The folded one!", 0.9, true, "ptt1")
            check(predictionVoiceOption(Trial.FLAT, voice, "ptt1") == "folded")
            check(predictionVoiceOption(Trial.FOLDED, voice, "ptt1") == null)
            check(predictionVoiceOption(Trial.FLAT, voice.copy(text = "flat or folded"), "ptt1") == null)
            check(predictionVoiceOption(Trial.FLAT, voice.copy(confidence = 0.84), "ptt1") == null)
            check(predictionVoiceOption(Trial.FLAT, voice.copy(confidence = Double.NaN), "ptt1") == null)
            check(predictionVoiceOption(Trial.FLAT, voice.copy(isFinal = false), "ptt1") == null)
            check(predictionVoiceOption(Trial.FLAT, voice, "other") == null)
        }
        expect("ambiguous voice leaves prediction unchanged and manual/remote remains available") {
            val engine = EpisodeCoordinator()
            val voice = VoiceTranscript("flat or folded", 0.95, true, "ptt1")
            check(!engine.acceptVoicePrediction(voice, "ptt1"))
            engine.begin(AdultPreflight(true, true, true, true))
            check(!engine.acceptVoicePrediction(voice, "ptt1"))
            check(engine.session.snapshot.stage == ManualStage.FLAT_PREDICTION)
            check(engine.acceptVoicePrediction(voice.copy(text = "same"), "ptt1"))
            check(engine.session.snapshot.episode.predictions[Trial.FLAT.predictionKey] == "same")
            engine.markStop(Trial.FLAT, 4)
            engine.confirm(Trial.FLAT, 4)
            check(!engine.acceptVoicePrediction(voice.copy(text = "same"), "ptt1"))
            engine.predict(Trial.FOLDED, "unsure")
            check(engine.session.snapshot.stage == ManualStage.FOLDED_LAB)
        }
        expect("adult preflight requires privacy and safety; analytics is optional") {
            val engine = EpisodeCoordinator()
            check(runCatching { engine.predict(Trial.FLAT, "unsure") }.isFailure)
            check(runCatching { engine.begin(AdultPreflight()) }.isFailure)
            check(engine.session.snapshot.stage == ManualStage.SAFETY_AND_CONSENT)
            engine.begin(AdultPreflight(true, true, true, true))
            check(engine.preflight.accepted?.analyticsConsent == false)
            engine.predict(Trial.FLAT, "unsure")
            engine.markStop(Trial.FLAT, 5)
            engine.confirm(Trial.FLAT, 4)
            check(engine.session.flatResultSceneParameters()["load_count"] == 4)
        }
        expect("camera denial has complete manual fallback") {
            val engine = EpisodeCoordinator()
            check(runCatching { engine.begin(AdultPreflight(true, true, true, true, cameraChoice = CameraChoice.COMPANION, cameraPermission = CameraPermission.DENIED)) }.isFailure)
            engine.begin(AdultPreflight(true, true, true, true, cameraPermission = CameraPermission.DENIED))
            engine.predict(Trial.FLAT, "unsure")
            engine.markStop(Trial.FLAT, 3)
            engine.confirm(Trial.FLAT, 3)
            engine.predict(Trial.FOLDED, "unsure")
            engine.markStop(Trial.FOLDED, 7)
            engine.confirm(Trial.FOLDED, 7)
            check(engine.session.snapshot.episode.comparison() == ComparisonResult.GREATER)
        }
        expect("calibration and stable perception never auto-commit counts") {
            val engine = EpisodeCoordinator()
            engine.begin(AdultPreflight(true, true, true, true, cameraChoice = CameraChoice.COMPANION, cameraPermission = CameraPermission.GRANTED))
            engine.predict(Trial.FLAT, "unsure")
            val observation = CompanionObservation(Trial.FLAT, 1, 5, 0.9, 500, setOf(0, 1, 2, 3), 2.0, 0, PerceptionStatus.OBSERVING)
            engine.observe(observation.copy(markerIds = setOf(0, 1, 2)))
            check(engine.observation?.status == PerceptionStatus.NEEDS_CALIBRATION)
            check(runCatching { engine.markStop(Trial.FLAT, 9) }.isFailure)
            engine.observe(observation.copy(frameSequence = 2, stableDurationMs = 499))
            check(runCatching { engine.markStop(Trial.FLAT, 9) }.isFailure)
            engine.observe(observation.copy(frameSequence = 3, confidence = 0.5))
            check(engine.observation?.status == PerceptionStatus.NEEDS_REVIEW)
            check(runCatching { engine.markStop(Trial.FLAT, 9) }.isFailure)
            engine.observe(observation.copy(frameSequence = 4))
            check(!engine.observe(observation.copy(frameSequence = 3, stableCount = 8)))
            check(engine.session.snapshot.episode.measurements.isEmpty())
            engine.markStop(Trial.FLAT, 9)
            check(engine.session.snapshot.stoppedMeasurements[Trial.FLAT]?.lastStableCount == 5)
            engine.confirm(Trial.FLAT, 4)
            check(engine.session.flatResultSceneParameters()["load_count"] == 4)
        }
        expect("perception review calibration errors and NaN fail closed; manual override works") {
            val engine = EpisodeCoordinator()
            engine.begin(AdultPreflight(true, true, true, true, cameraChoice = CameraChoice.COMPANION, cameraPermission = CameraPermission.GRANTED))
            engine.predict(Trial.FLAT, "unsure")
            val observation = CompanionObservation(Trial.FLAT, 1, 5, 0.9, 500, setOf(0, 1, 2, 3), 2.0, 0, PerceptionStatus.OBSERVING)
            check(runCatching { engine.observe(observation.copy(confidence = Double.NaN)) }.isFailure)
            check(runCatching { engine.observe(observation.copy(stableCount = 31)) }.isFailure)
            engine.observe(observation.copy(reprojectionErrorPx = 8.1))
            check(engine.observation?.status == PerceptionStatus.NEEDS_CALIBRATION)
            engine.observe(observation.copy(frameSequence = 2, occludedMs = 1001))
            check(engine.observation?.status == PerceptionStatus.NEEDS_CALIBRATION)
            engine.useManual()
            engine.markStop(Trial.FLAT, 2)
            engine.confirm(Trial.FLAT, 2)
            check(engine.session.flatResultSceneParameters()["load_count"] == 2)
        }
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
