package com.curiolab.episode

enum class Trial(val predictionKey: String, val measurementKey: String) {
    FLAT("predictions.flat_winner", "measurements.flat_load"),
    FOLDED("predictions.folded_change", "measurements.folded_load")
}

enum class ComparisonResult(val branchNodeId: String) {
    GREATER("node_greater"),
    EQUAL("node_equal"),
    LOWER("node_lower")
}

data class MeasuredSummary(
    val flatLoad: Int,
    val foldedLoad: Int,
    val comparison: ComparisonResult
)

data class EpisodeState(
    val predictions: Map<String, String> = emptyMap(),
    val measurements: Map<String, Int> = emptyMap(),
    val stateSequence: Long = 0
) {
    init {
        require(stateSequence >= 0) { "Episode state sequence cannot be negative" }
        require(predictions.keys.all { it in allowedPredictions }) { "Unknown prediction variable" }
        predictions.forEach { (variable, option) ->
            require(option in allowedPredictions.getValue(variable)) { "Prediction option is not authored" }
        }
        require(measurements.keys.all { key -> Trial.entries.any { it.measurementKey == key } }) {
            "Unknown measurement variable"
        }
        measurements.forEach { (key, count) ->
            require(count in 0..100) { "Confirmed count is outside declared bounds" }
            val trial = Trial.entries.single { it.measurementKey == key }
            require(trial.predictionKey in predictions) { "Measurement requires its prediction" }
        }
        require(stateSequence == (predictions.size + measurements.size).toLong()) {
            "Episode state sequence does not match committed values"
        }
    }

    fun commitPrediction(variable: String, option: String, expectedStateSequence: Long): EpisodeState {
        val existing = predictions[variable]
        if (existing != null) {
            require(existing == option) { "A committed prediction cannot be changed by a duplicate message" }
            return this
        }
        require(expectedStateSequence == stateSequence) { "Stale prediction state sequence" }
        val allowed = allowedPredictions[variable]
        requireNotNull(allowed) { "Unknown prediction variable" }
        require(option in allowed) { "Prediction option is not authored for this variable" }
        return copy(
            predictions = predictions + (variable to option),
            stateSequence = stateSequence + 1
        )
    }

    fun confirmMeasurement(trial: Trial, confirmedCount: Int, expectedStateSequence: Long): EpisodeState {
        val existing = measurements[trial.measurementKey]
        if (existing != null) {
            require(existing == confirmedCount) { "A committed measurement cannot be changed by a duplicate message" }
            return this
        }
        require(expectedStateSequence == stateSequence) { "Stale measurement state sequence" }
        require(trial.predictionKey in predictions) { "A prediction must be committed before its lab result" }
        require(confirmedCount in 0..100) { "Confirmed count is outside declared bounds" }
        return copy(
            measurements = measurements + (trial.measurementKey to confirmedCount),
            stateSequence = stateSequence + 1
        )
    }

    fun flatResultSceneParameters(): Map<String, Int> {
        val count = measurements[Trial.FLAT.measurementKey]
        requireNotNull(count) { "Flat result requires a confirmed measurement" }
        return mapOf("load_count" to count)
    }

    fun comparison(): ComparisonResult {
        val flat = measurements[Trial.FLAT.measurementKey]
        val folded = measurements[Trial.FOLDED.measurementKey]
        requireNotNull(flat) { "Comparison requires flat_load" }
        requireNotNull(folded) { "Comparison requires folded_load" }
        return when {
            folded > flat -> ComparisonResult.GREATER
            folded < flat -> ComparisonResult.LOWER
            else -> ComparisonResult.EQUAL
        }
    }

    fun measuredSummary(): MeasuredSummary {
        require(Trial.entries.all { it.predictionKey in predictions }) {
            "Summary requires both authored predictions"
        }
        require(Trial.entries.all { it.measurementKey in measurements }) {
            "Summary requires both confirmed measurements"
        }
        return MeasuredSummary(
            flatLoad = measurements.getValue(Trial.FLAT.measurementKey),
            foldedLoad = measurements.getValue(Trial.FOLDED.measurementKey),
            comparison = comparison()
        )
    }

    companion object {
        private val allowedPredictions = mapOf(
            Trial.FLAT.predictionKey to setOf("flat", "folded", "same", "unsure"),
            Trial.FOLDED.predictionKey to setOf("more", "fewer", "same", "unsure")
        )
    }
}
