package com.curiolab.episode


enum class PerceptionStatus { OBSERVING, NEEDS_REVIEW, NEEDS_CALIBRATION }
data class CompanionObservation(
    val trial: Trial,
    val frameSequence: Long,
    val stableCount: Int,
    val confidence: Double,
    val stableDurationMs: Long,
    val markerIds: Set<Int>,
    val reprojectionErrorPx: Double,
    val occludedMs: Long,
    val status: PerceptionStatus
)

/** Main coordinator: perception can propose a count but never commit a measurement. */
class EpisodeCoordinator {
    val preflight = AdultPreflightService()
    val session = ManualEpisodeSession()
    var observation: CompanionObservation? = null
        private set
    private var frameSequence = -1L

    fun begin(choice: AdultPreflight) {
        val blockers = preflight.accept(choice)
        require(blockers.isEmpty()) { blockers.joinToString(",") }
        session.acknowledgeSafety(true, true, true, session.snapshot.sequence)
    }
    fun predict(trial: Trial, option: String) {
        check(preflight.accepted != null) { "Preflight required" }
        session.commitPrediction(trial, option, session.snapshot.sequence)
        observation = null
        frameSequence = -1
    }
    fun observe(value: CompanionObservation): Boolean {
        check(preflight.accepted?.cameraChoice == CameraChoice.COMPANION) { "Camera not enabled" }
        val stage = if (value.trial == Trial.FLAT) ManualStage.FLAT_LAB else ManualStage.FOLDED_LAB
        check(session.snapshot.stage == stage) { "Observation outside active lab" }
        require(value.frameSequence >= 0 && value.stableCount in 0..30 && value.confidence.isFinite()
            && value.confidence in 0.0..1.0 && value.stableDurationMs >= 0 && value.occludedMs >= 0
            && value.reprojectionErrorPx.isFinite() && value.reprojectionErrorPx >= 0) { "Invalid observation" }
        if (value.frameSequence <= frameSequence) return false
        val calibrated = value.markerIds == setOf(0, 1, 2, 3) && value.reprojectionErrorPx <= 8 && value.occludedMs <= 1000
        val previous = observation
        val suddenDecrease = previous != null && value.stableCount < previous.stableCount
        observation = value.copy(status = when {
            !calibrated -> PerceptionStatus.NEEDS_CALIBRATION
            value.status != PerceptionStatus.OBSERVING || value.confidence < 0.65 || suddenDecrease -> PerceptionStatus.NEEDS_REVIEW
            else -> PerceptionStatus.OBSERVING
        })
        frameSequence = value.frameSequence
        return true
    }
    fun stop(trial: Trial, manualCount: Int) {
        val choice = checkNotNull(preflight.accepted) { "Preflight required" }
        val count = if (choice.cameraChoice == CameraChoice.MANUAL) manualCount else {
            val current = checkNotNull(observation) { "No stable observation; use manual mode" }
            check(current.trial == trial && current.status == PerceptionStatus.OBSERVING
                && current.stableDurationMs >= 500) { "Count needs review or calibration; use manual mode" }
            current.stableCount
        }
        session.markStop(trial, count, session.snapshot.sequence)
    }
    fun useManual() {
        check(preflight.accepted != null) { "Preflight required" }
        manualOverride = true
        observation = null
    }
    private var manualOverride = false
    fun markStop(trial: Trial, count: Int) {
        if (manualOverride) session.markStop(trial, count, session.snapshot.sequence)
        else stop(trial, count)
    }
    fun confirm(trial: Trial, count: Int) {
        session.confirmStoppedMeasurement(trial, count, session.snapshot.sequence)
    }
}
