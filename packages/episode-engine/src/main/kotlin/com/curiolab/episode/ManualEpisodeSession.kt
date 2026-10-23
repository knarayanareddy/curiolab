package com.curiolab.episode

enum class ManualStage {
    SAFETY_AND_CONSENT,
    FLAT_PREDICTION,
    FLAT_LAB,
    FLAT_CONFIRMATION,
    FOLDED_PREDICTION,
    FOLDED_LAB,
    FOLDED_CONFIRMATION,
    COMPARISON,
    REFLECTION,
    COMPLETE
}

data class StoppedMeasurement(
    val trial: Trial,
    val lastStableCount: Int
)

data class ManualEpisodeSnapshot(
    val stage: ManualStage = ManualStage.SAFETY_AND_CONSENT,
    val episode: EpisodeState = EpisodeState(),
    val stoppedMeasurements: Map<Trial, StoppedMeasurement> = emptyMap(),
    val reflection: String? = null,
    val sequence: Long = 0,
    val cameraMode: String = "manual_remote",
    val accessibilityMode: String = "standard"
)

data class ManualEpisodeSummary(
    val flatLoad: Int,
    val foldedLoad: Int,
    val comparison: ComparisonResult,
    val branchNodeId: String,
    val foldedPredictionMatched: Boolean?,
    val reflection: String,
    val variableChangePrompt: String
)

/**
 * Strict manual-mode coordinator around the deterministic episode state.
 * Snapshots are values only; durable storage and native rendering are separate adapters.
 */
class ManualEpisodeSession(initialSnapshot: ManualEpisodeSnapshot = ManualEpisodeSnapshot()) {
    var snapshot: ManualEpisodeSnapshot = initialSnapshot
        private set

    init {
        require(snapshot.cameraMode == "manual_remote") { "This coordinator accepts manual mode only" }
        require(snapshot.accessibilityMode in accessibilityModes) { "Unknown accessibility mode" }
        require(snapshot.sequence >= 0) { "Snapshot sequence cannot be negative" }
        require(snapshot.episode.stateSequence <= snapshot.sequence) { "Invalid snapshot sequences" }
        require(snapshot.sequence == snapshot.stage.ordinal.toLong()) {
            "Manual stage and sequence do not match"
        }
        require((snapshot.stage == ManualStage.COMPLETE) == (snapshot.reflection != null)) {
            "Completion and reflection must be committed together"
        }
        require(snapshot.reflection == null || snapshot.reflection in setOf("shape_can_matter", "not_sure")) {
            "Reflection is not authored"
        }
        snapshot.stoppedMeasurements.forEach { (trial, stopped) ->
            require(stopped.trial == trial) { "Stopped measurement trial does not match its key" }
            require(stopped.lastStableCount in 0..30) { "Stopped count is outside declared bounds" }
            require(trial.predictionKey in snapshot.episode.predictions) { "Stop requires its prediction" }
        }
        Trial.entries.forEach { trial ->
            if (trial.measurementKey in snapshot.episode.measurements) {
                require(trial in snapshot.stoppedMeasurements) { "Confirmed measurement requires its stop" }
            }
        }
        val expectedPredictions = when (snapshot.stage) {
            ManualStage.SAFETY_AND_CONSENT, ManualStage.FLAT_PREDICTION -> 0
            ManualStage.FLAT_LAB, ManualStage.FLAT_CONFIRMATION, ManualStage.FOLDED_PREDICTION -> 1
            else -> 2
        }
        val expectedMeasurements = when (snapshot.stage) {
            ManualStage.FOLDED_PREDICTION, ManualStage.FOLDED_LAB, ManualStage.FOLDED_CONFIRMATION -> 1
            ManualStage.COMPARISON, ManualStage.REFLECTION, ManualStage.COMPLETE -> 2
            else -> 0
        }
        val expectedStops = when (snapshot.stage) {
            ManualStage.FLAT_CONFIRMATION, ManualStage.FOLDED_PREDICTION, ManualStage.FOLDED_LAB -> 1
            ManualStage.FOLDED_CONFIRMATION, ManualStage.COMPARISON, ManualStage.REFLECTION, ManualStage.COMPLETE -> 2
            else -> 0
        }
        require(snapshot.episode.predictions.size == expectedPredictions) { "Predictions do not match the stage" }
        require(snapshot.episode.measurements.size == expectedMeasurements) { "Measurements do not match the stage" }
        require(snapshot.stoppedMeasurements.size == expectedStops) { "Stops do not match the stage" }
        if (expectedPredictions == 1) require(Trial.FLAT.predictionKey in snapshot.episode.predictions)
        if (expectedMeasurements == 1) require(Trial.FLAT.measurementKey in snapshot.episode.measurements)
        if (expectedStops == 1) require(Trial.FLAT in snapshot.stoppedMeasurements)
    }

    private fun requireStage(expected: ManualStage) {
        require(snapshot.stage == expected) { "Action is not allowed from ${snapshot.stage}" }
    }

    private fun requireSequence(expected: Long) {
        require(expected == snapshot.sequence) { "Stale manual episode state sequence" }
    }

    fun acknowledgeSafety(
        adultConsent: Boolean,
        safetyInstructionsAccepted: Boolean,
        smallObjectSupervisionConfirmed: Boolean,
        expectedSequence: Long
    ): ManualEpisodeSnapshot {
        requireStage(ManualStage.SAFETY_AND_CONSENT)
        requireSequence(expectedSequence)
        if (!adultConsent || !safetyInstructionsAccepted || !smallObjectSupervisionConfirmed) return snapshot
        snapshot = snapshot.copy(stage = ManualStage.FLAT_PREDICTION, sequence = snapshot.sequence + 1)
        return snapshot
    }

    fun commitPrediction(trial: Trial, option: String, expectedSequence: Long): ManualEpisodeSnapshot {
        val existing = snapshot.episode.predictions[trial.predictionKey]
        if (existing != null) {
            require(existing == option) { "A committed prediction cannot be changed" }
            return snapshot
        }
        val expectedStage = if (trial == Trial.FLAT) ManualStage.FLAT_PREDICTION else ManualStage.FOLDED_PREDICTION
        requireStage(expectedStage)
        requireSequence(expectedSequence)
        val episode = snapshot.episode.commitPrediction(
            trial.predictionKey,
            option,
            snapshot.episode.stateSequence
        )
        snapshot = snapshot.copy(
            stage = if (trial == Trial.FLAT) ManualStage.FLAT_LAB else ManualStage.FOLDED_LAB,
            episode = episode,
            sequence = snapshot.sequence + 1
        )
        return snapshot
    }

    fun markStop(trial: Trial, lastStableCount: Int, expectedSequence: Long): ManualEpisodeSnapshot {
        val existing = snapshot.stoppedMeasurements[trial]
        if (existing != null) {
            require(existing.lastStableCount == lastStableCount) { "A stopped count cannot be changed" }
            return snapshot
        }
        val expectedStage = if (trial == Trial.FLAT) ManualStage.FLAT_LAB else ManualStage.FOLDED_LAB
        requireStage(expectedStage)
        requireSequence(expectedSequence)
        require(lastStableCount in 0..30) { "Stopped count is outside the episode's declared bounds" }
        snapshot = snapshot.copy(
            stage = if (trial == Trial.FLAT) ManualStage.FLAT_CONFIRMATION else ManualStage.FOLDED_CONFIRMATION,
            stoppedMeasurements = snapshot.stoppedMeasurements +
                (trial to StoppedMeasurement(trial, lastStableCount)),
            sequence = snapshot.sequence + 1
        )
        return snapshot
    }

    fun confirmStoppedMeasurement(
        trial: Trial,
        confirmedCount: Int,
        expectedSequence: Long
    ): ManualEpisodeSnapshot {
        val existing = snapshot.episode.measurements[trial.measurementKey]
        if (existing != null) {
            require(existing == confirmedCount) { "A confirmed measurement cannot be changed" }
            return snapshot
        }
        val expectedStage = if (trial == Trial.FLAT) ManualStage.FLAT_CONFIRMATION else ManualStage.FOLDED_CONFIRMATION
        requireStage(expectedStage)
        requireSequence(expectedSequence)
        require(trial in snapshot.stoppedMeasurements) { "An adult-marked stop is required before confirmation" }
        require(confirmedCount in 0..30) { "Confirmed count is outside the episode's declared bounds" }
        val episode = snapshot.episode.confirmMeasurement(
            trial,
            confirmedCount,
            snapshot.episode.stateSequence
        )
        snapshot = snapshot.copy(
            stage = if (trial == Trial.FLAT) ManualStage.FOLDED_PREDICTION else ManualStage.COMPARISON,
            episode = episode,
            sequence = snapshot.sequence + 1
        )
        return snapshot
    }

    fun acknowledgeComparison(expectedSequence: Long): ManualEpisodeSnapshot {
        requireStage(ManualStage.COMPARISON)
        requireSequence(expectedSequence)
        snapshot.episode.comparison()
        snapshot = snapshot.copy(stage = ManualStage.REFLECTION, sequence = snapshot.sequence + 1)
        return snapshot
    }

    fun commitReflection(option: String, expectedSequence: Long): ManualEpisodeSnapshot {
        if (snapshot.reflection != null) {
            require(snapshot.reflection == option) { "A committed reflection cannot be changed" }
            return snapshot
        }
        requireStage(ManualStage.REFLECTION)
        requireSequence(expectedSequence)
        require(option in setOf("shape_can_matter", "not_sure")) { "Reflection is not authored" }
        snapshot = snapshot.copy(
            stage = ManualStage.COMPLETE,
            reflection = option,
            sequence = snapshot.sequence + 1
        )
        return snapshot
    }

    fun flatResultSceneParameters(): Map<String, Int> {
        require(snapshot.stage.ordinal > ManualStage.FLAT_CONFIRMATION.ordinal) {
            "Flat result cannot be shown before confirmation"
        }
        return snapshot.episode.flatResultSceneParameters()
    }

    fun measuredSummary(): ManualEpisodeSummary {
        requireStage(ManualStage.COMPLETE)
        val measured = snapshot.episode.measuredSummary()
        val prediction = snapshot.episode.predictions.getValue(Trial.FOLDED.predictionKey)
        val observedChange = when (measured.comparison) {
            ComparisonResult.GREATER -> "more"
            ComparisonResult.LOWER -> "fewer"
            ComparisonResult.EQUAL -> "same"
        }
        return ManualEpisodeSummary(
            flatLoad = measured.flatLoad,
            foldedLoad = measured.foldedLoad,
            comparison = measured.comparison,
            branchNodeId = measured.comparison.branchNodeId,
            foldedPredictionMatched = if (prediction == "unsure") null else prediction == observedChange,
            reflection = requireNotNull(snapshot.reflection),
            variableChangePrompt = "Repeat with one changed condition; one comparison does not establish a universal rule."
        )
    }

    private companion object {
        val accessibilityModes = setOf("standard", "reduced_motion", "no_timing")
    }
}
