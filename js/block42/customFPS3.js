﻿// player motion parameters
var start = function( gameLoop, gameViewportSize ) {


	var render = function( timeStamp ) {
		
		// call our game loop with the time elapsed since last rendering, in ms
		gameLoop();
		renderer.render( scene, camera );
		requestAnimationFrame( render );
	};
	requestAnimationFrame( render );
};

var lastTimeStamp, timeStamp;

var gameLoop = function(deltaTime) {
	var timeElapsed = lastTimeStamp ? timeStamp - lastTimeStamp : 0; 
	lastTimeStamp = timeStamp;
	resetPlayer();
	keyboardControls();
	jumpPads();
	//console.log(deltaTime);
	applyPhysics(deltaTime);
	updateCamera();
};






var motion = {
	airborne : false,
	position : new THREE.Vector3(), velocity : new THREE.Vector3(),
	rotation : new THREE.Vector2(), spinning : new THREE.Vector2()
};
motion.position.y = -150;



// game systems code
var resetPlayer = function() {
	if( motion.position.y < -123 ) {
		motion.position.set( -2, 7.7, 25 );
		motion.velocity.multiplyScalar( 0 );
	}
};

var keysPressed = {};
var keyboardControls = (function() {
	var keys = { SP : 32, W : 87, A : 65, S : 83, D : 68, UP : 38, LT : 37, DN : 40, RT : 39 };
	var keysPressed = {};
	(function( watchedKeyCodes ) {
		var handler = function( down ) {
			return function( e ) {
				var index = watchedKeyCodes.indexOf( e.keyCode );
				if( index >= 0 ) {
					keysPressed[watchedKeyCodes[index]] = down; e.preventDefault();
				}
				
			};
		};
		window.addEventListener( "keydown", handler( true ), false );
		window.addEventListener( "keyup", handler( false ), false );
	})([
		keys.SP, keys.W, keys.A, keys.S, keys.D, keys.UP, keys.LT, keys.DN, keys.RT
	]);
	var forward = new THREE.Vector3();
	var sideways = new THREE.Vector3();
	return function() {

		if( !motion.airborne ) 
		{
			// look around
			var sx = keysPressed[keys.UP] ? 0.03 : ( keysPressed[keys.DN] ? -0.03 : 0 );
			var sy = keysPressed[keys.LT] ? 0.03 : ( keysPressed[keys.RT] ? -0.03 : 0 );
			if( Math.abs( sx ) >= Math.abs( motion.spinning.x ) ) motion.spinning.x = sx;
			if( Math.abs( sy ) >= Math.abs( motion.spinning.y ) ) motion.spinning.y = sy;
			// move around
			forward.set( Math.sin( motion.rotation.y ), 0, Math.cos( motion.rotation.y ) );
			sideways.set( forward.z, 0, -forward.x );
			forward.multiplyScalar( keysPressed[keys.W] ? -0.1 : (keysPressed[keys.S] ? 0.1 : 0));
			sideways.multiplyScalar( keysPressed[keys.A] ? -0.1 : (keysPressed[keys.D] ? 0.1 : 0));
			var combined = forward.add( sideways );
			if( Math.abs( combined.x ) >= Math.abs( motion.velocity.x ) ) motion.velocity.x = combined.x;
			if( Math.abs( combined.y ) >= Math.abs( motion.velocity.y ) ) motion.velocity.y = combined.y;
			if( Math.abs( combined.z ) >= Math.abs( motion.velocity.z ) ) motion.velocity.z = combined.z;
			//jump
 			var vy = keysPressed[keys.SP] ? 0.7 : 0;
 			motion.velocity.y += vy;
		}

	};
})();


var jumpPads = (function() {
	var pads = [ new THREE.Vector3( -17.5, 8, -10 ), new THREE.Vector3( 17.5, 8, -10 ), new THREE.Vector3( 0, 8, 21 ) ];
	var temp = new THREE.Vector3();
	return function() {
		if( !motion.airborne ) {
			for( var j = 0, n = pads.length; j < n; j++ ) {
				if ( pads[j].distanceToSquared( motion.position ) < 2.3 ) {
					// calculate velocity towards another side of platform from jump pad position
					temp.copy( pads[j] ); temp.y = 0; temp.setLength( -0.8 ); temp.y = 0.7;
					motion.airborne = true; motion.velocity.copy( temp ); break;
				}
			}
		}
	};
})();


var applyPhysics = (function() {
	var timeStep = 5;
	var timeLeft = timeStep + 1;
	var birdsEye = 100;
	var kneeDeep = 0.4;
	var raycaster = new THREE.Raycaster();
	raycaster.ray.direction.set( 0, -1, 0 );
	var angles = new THREE.Vector2();
	var displacement = new THREE.Vector3();
	return function( dt ) {
		var platform = scene.getObjectByName( "platform", true );
		if( true ) {

			timeLeft += dt;
			// run several fixed-step iterations to approximate varying-step
			dt = 5;
			//console.log(timeLeft);
			while( timeLeft >= dt ) {
				var time = 0.3;
				damping = 0.93;
				gravity = 0.01;
				tau = 2 * Math.PI;
				raycaster.ray.origin.copy( motion.position );
				raycaster.ray.origin.y += birdsEye;
				var hits = raycaster.intersectObjects( [ scene ], true );
				motion.airborne = true;
				// are we above, or at most knee deep in, the platform?
				if( ( hits.length > 0 ) && ( hits[0].face.normal.y > 0 ) ) {
					var actualHeight = hits[0].distance - birdsEye;
					// collision: stick to the surface if landing on it
					if( ( motion.velocity.y <= 0 ) && ( Math.abs( actualHeight ) < kneeDeep ) ) {
						motion.position.y -= actualHeight;
						motion.velocity.y = 0;
						motion.airborne = false;
					}
				}
				if( motion.airborne ) motion.velocity.y -= gravity;
				angles.copy( motion.spinning ).multiplyScalar( time );
				if( !motion.airborne ) motion.spinning.multiplyScalar( damping );
				displacement.copy( motion.velocity ).multiplyScalar( time );
				if( !motion.airborne ) motion.velocity.multiplyScalar( damping );
				motion.rotation.add( angles );
				motion.position.add( displacement );
				// limit the tilt at ±0.4 radians
				motion.rotation.x = Math.max( -0.4, Math.min ( +0.4, motion.rotation.x ) );
				// wrap horizontal rotation to 0...2π
				motion.rotation.y += tau; motion.rotation.y %= tau;
				timeLeft -= dt;
				//console.log(motion.velocity);
			}
		}
	};
})();
var updateCamera = (function() {
	var euler = new THREE.Euler( 0, 0, 0, 'YXZ' );

	return function() {
		euler.x = motion.rotation.x;
		euler.y = motion.rotation.y;
		player.cameraObject.quaternion.setFromEuler( euler );
		player.cameraObject.position.copy( motion.position );
		player.cameraObject.position.y += 3.0;
	};
})();
