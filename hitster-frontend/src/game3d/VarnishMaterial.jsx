import { shaderMaterial } from "@react-three/drei";
import { extend } from "@react-three/fiber";
import * as THREE from "three";

// A thin transparent overlay, not a replacement for the table's lit
// material underneath — it only adds the glossy "clear coat" on top:
// a fresnel rim (brighter at grazing angles, like real varnish) plus a
// specular hotspot aimed at the pendant light above the table.
const VarnishMaterial = shaderMaterial(
  {
    lightDir: new THREE.Vector3(0, 1, 0.15).normalize(),
    color: new THREE.Color("#fff2d0"),
    fresnelPower: 3.2,
    fresnelStrength: 0.22,
    specStrength: 0.5,
  },
  /* vertex */ `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewDir = normalize(-mvPosition.xyz);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  /* fragment */ `
    uniform vec3 lightDir;
    uniform vec3 color;
    uniform float fresnelPower;
    uniform float fresnelStrength;
    uniform float specStrength;
    varying vec3 vNormal;
    varying vec3 vViewDir;

    void main() {
      vec3 n = normalize(vNormal);
      float fresnel = pow(1.0 - max(dot(n, vViewDir), 0.0), fresnelPower);

      vec3 halfDir = normalize(lightDir + vViewDir);
      float spec = pow(max(dot(n, halfDir), 0.0), 70.0);

      float glow = fresnel * fresnelStrength + spec * specStrength;
      gl_FragColor = vec4(color, glow);
    }
  `
);

extend({ VarnishMaterial });
export default VarnishMaterial;
