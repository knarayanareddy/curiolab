package com.curiolab.episode

/** JVM stdin adapter for the same protocol used by the browser sandbox. */
object SimulatorBridge {
    @JvmStatic fun main(args: Array<String>) {
        val protocol = SimulatorProtocol()
        generateSequence(::readlnOrNull).forEach { println(protocol.request(it)) }
    }
}
