@file:OptIn(ExperimentalJsExport::class)
package com.curiolab.episode

private val browserProtocol = SimulatorProtocol()
/** Real Kotlin coordinator with synthetic/manual input; no JVM or cloud in the browser. */
@JsExport
fun simulatorRequest(line: String): String = browserProtocol.request(line)
