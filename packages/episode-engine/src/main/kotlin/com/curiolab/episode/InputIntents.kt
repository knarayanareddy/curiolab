package com.curiolab.episode

import java.util.Locale

enum class RemoteIntent { UP, DOWN, LEFT, RIGHT, SELECT, BACK }
/** Android key codes, without Android imports. Voice-assist is OS-owned, not a mic API. */
fun remoteIntent(keyCode: Int, isKeyDown: Boolean, repeatCount: Int = 0): RemoteIntent? {
    if (!isKeyDown || repeatCount < 0 || (repeatCount > 0 && keyCode in setOf(23, 66, 4))) return null
    return when (keyCode) {
        19 -> RemoteIntent.UP
        20 -> RemoteIntent.DOWN
        21 -> RemoteIntent.LEFT
        22 -> RemoteIntent.RIGHT
        23, 66 -> RemoteIntent.SELECT
        4 -> RemoteIntent.BACK
        else -> null
    }
}

data class VoiceTranscript(val text: String, val confidence: Double, val isFinal: Boolean, val pushToTalkSession: String)
/** Ephemeral text input only; caller must discard the transcript after this pure mapping. */
fun predictionVoiceOption(trial: Trial, transcript: VoiceTranscript, expectedPushToTalkSession: String): String? {
    if (!transcript.isFinal || !transcript.confidence.isFinite() || transcript.confidence !in 0.85..1.0 ||
        transcript.pushToTalkSession != expectedPushToTalkSession || !expectedPushToTalkSession.matches(Regex("[A-Za-z0-9_-]{1,80}")) ||
        transcript.text.length !in 1..160 || transcript.text.any { it.isISOControl() }) return null
    val normalized = transcript.text.lowercase(Locale.ROOT).trim().replace(Regex("[.!?]$"), "").replace(Regex("\\s+"), " ")
    val phrases = if (trial == Trial.FLAT) mapOf(
        "flat" to "flat", "flat paper" to "flat", "the flat one" to "flat",
        "folded" to "folded", "folded paper" to "folded", "the folded one" to "folded",
        "same" to "same", "the same" to "same", "equal" to "same",
        "unsure" to "unsure", "not sure" to "unsure", "i don't know" to "unsure"
    ) else mapOf(
        "more" to "more", "more coins" to "more", "fewer" to "fewer", "less" to "fewer", "fewer coins" to "fewer",
        "same" to "same", "the same" to "same", "equal" to "same",
        "unsure" to "unsure", "not sure" to "unsure", "i don't know" to "unsure"
    )
    return phrases[normalized]
}
