package com.motionlayer.render
import com.motionlayer.data.*
class RenderEngine { fun visibleLayers(project:MotionLayerProject,timeMs:Long)=project.layers.filter{it.visible && timeMs in it.startTimeMs..it.endTimeMs}.sortedBy{it.zIndex}.map{KeyframeInterpolator.interpolateLayerAtTime(it,timeMs)} }
