package com.curiolab.episode

/** Local simulator stdin protocol. No persistence, cloud relay or native camera is implied. */
object SimulatorBridge {
    @JvmStatic fun main(args: Array<String>) {
        val engines = mutableMapOf<String, EpisodeCoordinator>()
        generateSequence(::readlnOrNull).forEach { line ->
            try {
                require(line.length <= 4096)
                val p = line.split('\t')
                require(p[0].matches(Regex("[a-f0-9-]{36}")))
                val engine = engines.getOrPut(p[0]) {
                    require(engines.size < 100) { "Simulator capacity reached" }
                    EpisodeCoordinator()
                }
                when (p[1]) {
                    "begin" -> engine.begin(AdultPreflight(p[2].toBooleanStrict(), p[3].toBooleanStrict(), p[4].toBooleanStrict(),
                        p[5].toBooleanStrict(), p[6].toBooleanStrict(), CameraChoice.valueOf(p[7]), CameraPermission.valueOf(p[8]), p[9]))
                    "predict" -> engine.predict(Trial.valueOf(p[2]), p[3])
                    "stop" -> engine.markStop(Trial.valueOf(p[2]), p[3].toInt())
                    "confirm" -> engine.confirm(Trial.valueOf(p[2]), p[3].toInt())
                    "manual" -> engine.useManual()
                    "observe" -> engine.observe(CompanionObservation(Trial.valueOf(p[2]), p[3].toLong(), p[4].toInt(), p[5].toDouble(),
                        p[6].toLong(), p[7].split(',').filter { it.isNotEmpty() }.map { it.toInt() }.toSet(), p[8].toDouble(), p[9].toLong(), PerceptionStatus.valueOf(p[10])))
                    "compare" -> engine.session.acknowledgeComparison(engine.session.snapshot.sequence)
                    "reflect" -> engine.session.commitReflection(p[2], engine.session.snapshot.sequence)
                    "state" -> Unit
                    "delete" -> { engines.remove(p[0]); println("{\"deleted\":true}"); return@forEach }
                    else -> error("Unknown command")
                }
                val snapshot = engine.session.snapshot
                val flat = snapshot.episode.measurements[Trial.FLAT.measurementKey]
                val folded = snapshot.episode.measurements[Trial.FOLDED.measurementKey]
                val stopped = snapshot.stoppedMeasurements.values.lastOrNull()?.lastStableCount
                val comparison = if (flat != null && folded != null) "\"${snapshot.episode.comparison()}\"" else "null"
                println("{\"stage\":\"${snapshot.stage}\",\"sequence\":${snapshot.sequence},\"flat\":$flat,\"folded\":$folded,\"stopped\":$stopped,\"comparison\":$comparison,\"perception\":\"${engine.observation?.status ?: "NONE"}\",\"observed\":${engine.observation?.stableCount ?: 0}}")
            } catch (error: Exception) {
                // Never echo untrusted command data or private inputs.
                println("{\"error\":\"Action rejected. Check consent, current step, calibration and count; manual mode remains available.\"}")
            }
        }
    }
}
