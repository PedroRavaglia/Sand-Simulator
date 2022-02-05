
var canvas = document.getElementById("webgl-canvas");
var gl = canvas.getContext("webgl2");
if (!gl) console.log("Not ennable to run WebGL2 with this browser");

window.onresize = function() {
    location.reload();
}

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

var app = PicoGL.createApp(canvas)
.clearColor(0.0, 0.0, 0.0, 1.0)
.clear();


const updateVert = `
#version 300 es
precision mediump float;

in vec2 pos;

void main() {
    gl_Position = vec4(pos, 0, 1);
}`

const updateFrag = `
#version 300 es
precision mediump float;

uniform sampler2D currState;
uniform vec2 mouse;
uniform vec2 dim;
uniform float s;
uniform int clicked;

out vec4 fragColor;
void main() {
    vec2 p = gl_FragCoord.xy;
    vec3 color = texture(currState, p / dim).xyz;

    fragColor = vec4(color.xy, 0., 1.);

    vec2 mouse_draw = vec2(mouse.x - p.x, (dim.y - mouse.y) - p.y); 

    if (clicked == 1) {
        if ( all(greaterThan(mouse_draw, vec2(-2., 0.))) && all(lessThan(mouse_draw, vec2(1., 1.))) )
            fragColor = vec4(0., 1., 0., 1.);
    }
    

    if (color.y == 0.) {
        if (p.y + 1. < dim.y) {
            if (texture(currState, (p + vec2(0., 1.)) / dim).y == 1.)
                fragColor = vec4(0., 1., 0., 1.);
            if (p.x - 1. > 0.)
                if (texture(currState, (p + vec2(-1., 1.)) / dim).y == 1. && texture(currState, (p + vec2(-1., 0.)) / dim).y == 1.) 
                    fragColor = vec4(0., 1., 0., 1.);

            if (p.x + 1. < dim.x)
                if (texture(currState, (p + vec2(1., 1.)) / dim).y == 1. && texture(currState, (p + vec2(1., 0.)) / dim).y == 1.) {
                    if (texture(currState, (p + vec2(2., 0.)) / dim).y == 1. || p.x + 2. > dim.x)
                        fragColor = vec4(0., 1., 0., 1.);
            }
        }
        
    }
    
    if (color.y == 1.) {
        if (p.y - 1. > 0.) {
            if (texture(currState, (p + vec2(0., -1.)) / dim).y == 0.)
                fragColor = vec4(1., 0., 0., 1.);
            
            if (p.x - 1. > 0.)
                if (texture(currState, (p + vec2(0., -1.)) / dim).y == 1. && texture(currState, (p + vec2(-1., -1.)) / dim).y == 0.)
                    fragColor = vec4(1., 0., 0., 1.);
            if (p.x + 1. < dim.x)
                if (texture(currState, (p + vec2(0., -1.)) / dim).y == 1. && texture(currState, (p + vec2(1., -1.)) / dim).y == 0.)
                    fragColor = vec4(1., 0., 0., 1.);
        }
    }
    
}`

const drawVert = `
#version 300 es

in vec2 pos;

void main () {
    gl_Position = vec4(pos, 0, 1);
}`

const drawFrag = `
#version 300 es
precision mediump float;

uniform vec2 dim;
uniform float s;
uniform sampler2D nextGridState;

float random (vec2 st) {
    return fract(sin(dot(st.xy,
                         vec2(12.9898,78.233)))*
        43758.5453123);
}

out vec4 fragColor;
void main() {
    vec2 p = gl_FragCoord.xy/s;
    vec2 color = texture(nextGridState, p / dim).xy;

    vec2 st = gl_FragCoord.xy / s;
    vec2 ipos = floor(st);  // get the integer coords

    vec3 c = vec3(random( ipos ));

    if (color.y == 1.)
        fragColor = vec4(
            mix(0.9, 1.0, random( ipos )), 
            mix(0.75, 0.8, random( ipos + vec2(1.) )),
            mix(0.5, 0.6, random( ipos + vec2(2.) )), 1.) * mix(0.7, 1.0, 1.);
    else
        fragColor = vec4(1.);

    if (p.y > dim.y - 1. || p.x > dim.x )
        fragColor = vec4(1.);
}`


var quadPositions = app.createVertexBuffer(PicoGL.FLOAT, 2, new Float32Array([
    -1.0,  1.0,
     1.0,  1.0, 
    -1.0, -1.0, 
    -1.0, -1.0,
     1.0,  1.0,
     1.0, -1.0
]));
var vertexArray = app.createVertexArray();
vertexArray.vertexAttributeBuffer(0, quadPositions);

// Setting textures:

let size = [canvas.width, canvas.height];
let s = 8;
let dim = [parseInt(size[0]/s), parseInt(size[1]/s)];

const initialGridState = new Uint8Array((dim.x / s) * (dim.y / s)* 4);
for (let i = 0; i < canvas.width * canvas.height; ++i) {
    initialGridState[i*4] = 255;
}

var currGridState_tex = app.createTexture2D(initialGridState, canvas.width/s, canvas.height/s, {
    magFilter: PicoGL.NEAREST,
});
var currGridState = app.createFramebuffer();
currGridState.colorTarget(0, currGridState_tex);

var nextGridState_tex = app.createTexture2D(initialGridState, canvas.width/s, canvas.height/s, {
    magFilter: PicoGL.NEAREST,
});
var nextGridState = app.createFramebuffer();
nextGridState.colorTarget(0, nextGridState_tex);


let mouse = [0, 0];
let clicked = 0;

app.createPrograms([updateVert, updateFrag], [drawVert, drawFrag]).then(([updateProgram, drawProgram]) => {

    var drawCall_update = app.createDrawCall(updateProgram, vertexArray)
    .texture("currState", currGridState.colorAttachments[0])
    .uniform('mouse', mouse)
    .uniform('dim', dim)
    .uniform('s', s);

    var drawCall = app.createDrawCall(drawProgram, vertexArray)
    .texture("nextGridState", nextGridState.colorAttachments[0])
    .uniform('dim', dim)
    .uniform('s', s)
    
    function drawFrame() {

        drawCall_update.uniform('mouse', mouse);
        drawCall_update.uniform('clicked', clicked);
        
        app.drawFramebuffer(nextGridState);
        drawCall_update.draw();

        app.readFramebuffer(nextGridState)
        .drawFramebuffer(currGridState)
        .blitFramebuffer(PicoGL.COLOR_BUFFER_BIT);

        app.defaultDrawFramebuffer();
        drawCall.draw();

        window.requestAnimationFrame(drawFrame);
    }
    window.requestAnimationFrame(drawFrame);
});


// EVENTS:

document.addEventListener('mousedown', (event) => {
    mouse[0] = event.layerX*dim[0]/window.innerWidth;
    mouse[1] = event.layerY*dim[1]/window.innerHeight;

    clicked = 1;
})

document.addEventListener('mousemove', (event) => {
    mouse[0] = event.layerX*dim[0]/window.innerWidth;
    mouse[1] = event.layerY*dim[1]/window.innerHeight;
})

document.addEventListener('mouseup', (event) => {
    clicked = 0;
})