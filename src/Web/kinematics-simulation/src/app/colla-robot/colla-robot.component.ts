import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Collada, ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

import * as TWEEN from '@tweenjs/tween.js';
import * as THREE from 'three';
import { GUI } from 'dat.gui';

@Component({
  selector: 'app-colla-robot',
  templateUrl: './colla-robot.component.html',
  styleUrls: ['./colla-robot.component.scss']
})
export class CollaRobotComponent implements OnInit, AfterViewInit {

  /** canvas */
  @ViewChild('canvas') private canvasRef: ElementRef;
  private get canvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }

  /** view */
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;

  /** model */
  private collaLoader = new ColladaLoader();
  private model: any;
  private kinematics;
  private kinematicsTween;
  private tweenParameters = {};

  /** camera */
  private fieldOfView: number = 45;
  private nearClippingPane: number = 1;
  private farClippingPane: number = 2000;

  /** grid */
  private showGrid: boolean = true;

  /** target control */
  private posTarget = {
    joint_1: 30,
    joint_2: 30,
    joint_3: 30,
    joint_4: 30,
    joint_5: 30,
    joint_6: 30,
    move: false
  };  // TODO

  constructor() { }

  ngAfterViewInit(): void {
    this.createScene();
    this.animate();
    this.createControls();
    this.createPanel();
  }

  ngOnInit(): void {
  }

  createScene(): void {
    this.renderer = new THREE.WebGLRenderer({canvas: this.canvas, antialias: true});
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);

    this.scene = new THREE.Scene();
    //this.scene.background = new THREE.Color(0xd4d4d8);
    
    this.initCamera();
    this.initModel();
    this.initGrid();
    this.initLight();
    //window.addEventListener('resize', this.onWindowResize)
  }

  animate(): void {
    requestAnimationFrame(() => {this.animate()});
    this.renderer.render(this.scene, this.camera);
    TWEEN.update();
  }

  createControls(): void {
    let renderer = new CSS2DRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0px';
    document.body.appendChild(renderer.domElement);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.autoRotate = true;
    this.controls.enableZoom = true;
    this.controls.enablePan = false;
    this.controls.update();
  }

  createPanel(): void {
    let gui = new GUI();
    let panelFolder = gui.addFolder('Control Panel');
    panelFolder.add(this.posTarget, 'joint_1', 0, 360);
    panelFolder.add(this.posTarget, 'joint_2', 0, 360);
    panelFolder.add(this.posTarget, 'joint_3', 0, 360);
    panelFolder.add(this.posTarget, 'joint_4', 0, 360);
    panelFolder.add(this.posTarget, 'joint_5', 0, 360);
    panelFolder.add(this.posTarget, 'joint_6', 0, 360);

    let buttonFunc = { goToPosition: () => {
      this.setToPosition()
    }};
    panelFolder.add(buttonFunc, 'goToPosition').name('Go To Position');

    panelFolder.open();
  }

  private initCamera(): void {
    let aspect = this.getAspectRatio();
    this.camera = new THREE.PerspectiveCamera(
      this.fieldOfView,
      aspect,
      this.nearClippingPane,
      this.farClippingPane
    );
    this.camera.position.set(10, 10, 15);

    this.scene.add(this.camera);
  }

  private getAspectRatio(): number {
    return this.canvas.clientWidth / this.canvas.clientHeight;
  }

  private initGrid(): void {
    let grid = new THREE.GridHelper(20, 20, 0x888888, 0x444444);
    if (this.showGrid) {
      this.scene.add(grid);
    } else {
      this.scene.remove(grid);
    }
  }

  private initLight(): void {
    let hemisohereLight = new THREE.HemisphereLight(0xffeeee, 0x111122);
    this.scene.add(hemisohereLight);
    let ambientLight = new THREE.AmbientLight(0x00000, 100);
    this.scene.add(ambientLight);
  }

  private initModel(): void {
    this.collaLoader.load('assets/collada/abb_irb52_7_120.dae', (collada: Collada) => {
      this.model = collada.scene;
      this.model.traverse((child) => {
        if (child.isMesh) {
          child.material.flatShading = true;
        }
      });
      this.model.scale.x = 6;
      this.model.scale.y = 6;
      this.model.scale.z = 6;

      this.scene.add(this.model);

      this.kinematics = collada.kinematics;
      this.setupTween();
    });
  }

  private setupTween(): void {
    let duration = THREE.MathUtils.randInt(1000, 5000);
    let target = {};

    for (let prop in this.kinematics.joints) {
      if (this.kinematics.joints.hasOwnProperty(prop)) {
        if (!this.kinematics.joints[prop].static) {
          let joint = this.kinematics.joints[prop];
          let old = this.tweenParameters[prop];
          let position = old ? old : joint.zeroPosition;
          this.tweenParameters[prop] = position;
          target[prop] = THREE.MathUtils.randInt(joint.limits.min, joint.limits.max);
        }
      }
    }

    //this.kinematicsTween = new TWEEN.Tween(this.tweenParameters).to(target, duration).easing(TWEEN.Easing.Quadratic.Out);
    this.kinematicsTween = new TWEEN.Tween(this.tweenParameters).to(this.posTarget, duration).easing(TWEEN.Easing.Quadratic.Out);

    this.kinematicsTween.onUpdate((obj) => {
      for (let prop in this.kinematics.joints) {
        if (this.kinematics.joints.hasOwnProperty(prop)) {
          if (!this.kinematics.joints[prop].static) {
            this.kinematics.setJointValue(prop, obj[prop]);
          }
        }
      }
    });
    //this.kinematicsTween.start();
    setTimeout(() => {this.setupTween()}, duration);
  }

  private onWindowResize() {
    let aspect = this.getAspectRatio();
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setToPosition(): void {
    this.kinematicsTween.start();
  }

}
