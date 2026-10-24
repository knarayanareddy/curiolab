package com.curiolab.episode

enum class CameraPermission { NOT_REQUESTED, GRANTED, DENIED, UNAVAILABLE }
enum class CameraChoice { MANUAL, COMPANION }
data class AdultPreflight(
    val adultConsent: Boolean = false,
    val privacyAcknowledged: Boolean = false,
    val safetyAccepted: Boolean = false,
    val smallObjectSupervision: Boolean = false,
    val analyticsConsent: Boolean = false,
    val cameraChoice: CameraChoice = CameraChoice.MANUAL,
    val cameraPermission: CameraPermission = CameraPermission.NOT_REQUESTED,
    val accessibilityMode: String = "standard"
) {
    fun blockers(): List<String> = buildList {
        if (!adultConsent) add("adult_consent_required")
        if (!privacyAcknowledged) add("privacy_acknowledgement_required")
        if (!safetyAccepted) add("safety_guidelines_required")
        if (!smallObjectSupervision) add("small_object_supervision_required")
        if (cameraChoice == CameraChoice.COMPANION && cameraPermission != CameraPermission.GRANTED)
            add("camera_unavailable_use_manual")
        if (accessibilityMode !in setOf("standard", "reduced_motion", "no_timing"))
            add("invalid_accessibility_mode")
    }
}

/** Records adult choices, not proof of a native OS permission request. */
class AdultPreflightService {
    var accepted: AdultPreflight? = null
        private set
    fun accept(choice: AdultPreflight): List<String> {
        check(accepted == null) { "Preflight already accepted" }
        val blockers = choice.blockers()
        if (blockers.isEmpty()) accepted = choice
        return blockers
    }
}
