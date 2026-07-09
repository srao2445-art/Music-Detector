package com.motionlayer.data
import kotlinx.serialization.Serializable

@Serializable enum class LayerType { VIDEO, IMAGE, TEXT, SHAPE }
@Serializable enum class ShapeType { RECTANGLE, CIRCLE, ROUNDED_RECTANGLE, LINE, POLYGON }
@Serializable enum class MaskType { RECTANGLE, CIRCLE, LINEAR }
@Serializable enum class EasingMode { Linear, EaseIn, EaseOut, EaseInOut, Smooth, Bounce, Elastic, Back }
@Serializable data class CanvasSpec(val width:Int=1080,val height:Int=1920,val fps:Int=30,val ratio:String="9:16")
@Serializable data class MainVideo(val uri:String="",val durationMs:Long=12000)
@Serializable data class ExportSettings(val format:String="mp4",val resolution:String="1080x1920",val fps:Int=30,val bitrate:Int=8_000_000)
@Serializable data class LayerStyle(val blur:Float=0f,val brightness:Float=1f,val contrast:Float=1f,val saturation:Float=1f,val shadowEnabled:Boolean=false,val shadowOpacity:Float=.35f,val shadowBlur:Float=16f,val shadowOffsetX:Float=12f,val shadowOffsetY:Float=12f,val reflectionEnabled:Boolean=false,val reflectionOpacity:Float=.25f)
@Serializable data class LayerMask(val maskEnabled:Boolean=false,val maskType:MaskType=MaskType.RECTANGLE,val maskFeather:Float=0f,val maskX:Float=0f,val maskY:Float=0f,val maskWidth:Float=300f,val maskHeight:Float=300f)
@Serializable data class MotionBlur(val enabled:Boolean=false,val amount:Float=0f,val autoDirection:Boolean=true,val directionDegrees:Float=0f)
@Serializable data class TextStyle(val fontSize:Float=48f,val bold:Boolean=false,val italic:Boolean=false,val color:Long=0xffffffff,val alignment:String="Center",val letterSpacing:Float=0f,val lineSpacing:Float=1f)
@Serializable data class ShapeStyle(val fillColor:Long=0xff7c5cff,val strokeColor:Long=0xffffffff,val strokeWidth:Float=0f)
@Serializable data class Keyframe(val id:String,val layerId:String,val timeMs:Long,val x:Float?=null,val y:Float?=null,val scaleX:Float?=null,val scaleY:Float?=null,val rotationX:Float?=null,val rotationY:Float?=null,val rotationZ:Float?=null,val zDepth:Float?=null,val opacity:Float?=null,val blur:Float?=null,val shadowOpacity:Float?=null,val maskX:Float?=null,val maskY:Float?=null,val maskWidth:Float?=null,val maskHeight:Float?=null,val easing:EasingMode=EasingMode.Linear)
@Serializable data class Layer(val id:String,val name:String,val type:LayerType,val sourceUri:String?=null,val text:String?=null,val shapeType:ShapeType?=null,val startTimeMs:Long=0,val endTimeMs:Long=5000,val zIndex:Int=0,val visible:Boolean=true,val locked:Boolean=false,val x:Float=540f,val y:Float=960f,val scaleX:Float=1f,val scaleY:Float=1f,val rotationZ:Float=0f,val rotationX:Float=0f,val rotationY:Float=0f,val zDepth:Float=0f,val opacity:Float=1f,val style:LayerStyle=LayerStyle(),val mask:LayerMask=LayerMask(),val motionBlur:MotionBlur=MotionBlur(),val textStyle:TextStyle=TextStyle(),val shapeStyle:ShapeStyle=ShapeStyle(),val keyframes:List<Keyframe> = emptyList())
@Serializable data class MotionLayerProject(val projectId:String,val projectName:String,val canvas:CanvasSpec=CanvasSpec(),val mainVideo:MainVideo=MainVideo(),val layers:List<Layer> = emptyList(),val export:ExportSettings=ExportSettings(),val backgroundBlur:Float=0f,val backgroundScale:Float=1f,val cameraZoom:Float=1f)
