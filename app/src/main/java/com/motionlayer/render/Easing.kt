package com.motionlayer.render
import com.motionlayer.data.EasingMode
import kotlin.math.*
object Easing { fun apply(mode:EasingMode,t:Float):Float { val x=t.coerceIn(0f,1f); return when(mode){ EasingMode.Linear->x; EasingMode.EaseIn->x*x; EasingMode.EaseOut->1-(1-x)*(1-x); EasingMode.EaseInOut-> if(x<.5f) 2*x*x else 1-((-2*x+2).pow(2))/2; EasingMode.Smooth->x*x*(3-2*x); EasingMode.Bounce->abs(sin(6.28f*(x+1)*(x+1))*(1-x)); EasingMode.Elastic-> if(x==0f||x==1f)x else (2.0.pow((-10*x).toDouble())*sin(((x*10-.75)*(2*Math.PI/3))).toFloat()+1); EasingMode.Back->{ val c=1.70158f; 1+(c+1)*(x-1).pow(3)+c*(x-1).pow(2) } } } }
