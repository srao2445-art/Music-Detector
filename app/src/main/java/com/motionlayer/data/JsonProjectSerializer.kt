package com.motionlayer.data
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
object JsonProjectSerializer { val json = Json { prettyPrint = true; ignoreUnknownKeys = true }; fun encode(p:MotionLayerProject)= json.encodeToString(p); fun decode(s:String)= json.decodeFromString<MotionLayerProject>(s) }
