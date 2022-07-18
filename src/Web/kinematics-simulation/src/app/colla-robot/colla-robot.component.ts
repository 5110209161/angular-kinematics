import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Collada, ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

import * as TWEEN from '@tweenjs/tween.js';
import * as THREE from 'three';
import { Pane } from 'tweakpane';

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
  private scaleSize: number = 6;
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

  pane: Pane;
  modelParams = {
    modelName: '',
  };

  constructor() { }

  ngAfterViewInit(): void {
    this.createScene();
    this.animate();
    this.createControls();
    this.createPanel();
  }

  ngOnInit(): void {
  }

  /** Rendering loop */
  animate(): void {
    requestAnimationFrame(() => {this.animate()});
    this.renderer.render(this.scene, this.camera);
    TWEEN.update();
  }

  /** Create scene */
  createScene(): void {
    this.renderer = new THREE.WebGLRenderer({canvas: this.canvas, antialias: true});
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);

    this.scene = new THREE.Scene();
    //this.scene.background = new THREE.Color(0xd4d4d8);

    let axesHelper = new THREE.AxesHelper(10);
    this.scene.add(axesHelper);
    
    this.initCamera();
    this.initGrid();
    this.initLight();

    //window.addEventListener('resize', this.onWindowResize, false)
  }

  /** Create orbit control */
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

  /** Create control panel */
  createPanel(): void {
    this.pane = new Pane();

    // Tabs
    const tabs = this.pane.addTab({
      pages: [
        { title: 'Model' },
        { title: 'Control' }
      ]
    });

    // Load Model
    tabs.pages[0].addInput(this.modelParams, 'modelName', { disabled: true, label: 'File' });

    let btnOpen = tabs.pages[0].addButton({ title: 'Open' });
    btnOpen.on('click', () => {
      document.getElementById('upload-dae-file').click();
    });

    let btnReset = tabs.pages[0].addButton({ title: 'Reset' });
    btnReset.on('click', () => {
      this.onResetBtnClicked();
    });
  }

  /** Open file explore and load DAE file */
  addDaeAttachment(fileInput: any): void {
    let fileRead = fileInput.target.files[0];
    // update file name to input box
    let daeFileName = fileRead ? fileRead.name : 'Invalid file!';
    this.modelParams.modelName = daeFileName;
    this.pane.refresh();
    
    let extraFiles = {};
    let files = fileInput.currentTarget.files;
    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      if (files[i].name.match(/\w*.dae\b/i)) {
        extraFiles[file.name] = file;
      }
    }

    const loadingManager = new THREE.LoadingManager();
    loadingManager.setURLModifier((url) => {
      let urlList = url.split('/');
      url = urlList[urlList.length - 1];

      if (extraFiles[url] !== undefined) {
        let blobUrl = URL.createObjectURL(extraFiles[url]);
        return blobUrl;
      }
      return url;
    });
    this.collaLoader = new ColladaLoader(loadingManager);
    this.initModel(daeFileName, this.scaleSize);
  }

  private onWindowResize() {
    let aspect = this.getAspectRatio();
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /** Init DAE model and add it into scene */
  private initModel(modelPath: string, scaleSize: number = 1): void {
    this.collaLoader.load(modelPath, (collada: Collada) => {
      this.model = collada.scene;
      this.model.traverse((child) => {
        if (child.isMesh) {
          child.material.flatShading = true;
        }
      });
      this.model.scale.x = scaleSize;
      this.model.scale.y = scaleSize;
      this.model.scale.z = scaleSize;

      this.scene.add(this.model);

      this.kinematics = collada.kinematics;
      this.setupTween();
    });
  }

  /** Init settings of camera */
  private initCamera(): void {
    let aspect = this.getAspectRatio();
    this.camera = new THREE.PerspectiveCamera(
      this.fieldOfView,
      aspect,
      this.nearClippingPane,
      this.farClippingPane
    );
    this.camera.position.set(10, 10, 15);
    this.camera.lookAt(this.scene.position);

    this.scene.add(this.camera);
  }

  /** Get the aspect ratio of the rendering window */
  private getAspectRatio(): number {
    return this.canvas.clientWidth / this.canvas.clientHeight;
  }

  /** Add grid into scene */
  private initGrid(): void {
    let grid = new THREE.GridHelper(20, 20, 0x888888, 0x444444);
    if (this.showGrid) {
      this.scene.add(grid);
    } else {
      this.scene.remove(grid);
    }
  }

  /** Add light into scene */
  private initLight(): void {
    let hemisohereLight = new THREE.HemisphereLight(0xffeeee, 0x111122);
    this.scene.add(hemisohereLight);
    let ambientLight = new THREE.AmbientLight(0x00000, 100);
    this.scene.add(ambientLight);
  }

  /** Setup tween */
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

    this.kinematicsTween = new TWEEN.Tween(this.tweenParameters).to(target, duration).easing(TWEEN.Easing.Quadratic.Out);
    //this.kinematicsTween = new TWEEN.Tween(this.tweenParameters).to(this.posTarget, duration).easing(TWEEN.Easing.Quadratic.Out);

    this.kinematicsTween.onUpdate((obj) => {
      for (let prop in this.kinematics.joints) {
        if (this.kinematics.joints.hasOwnProperty(prop)) {
          if (!this.kinematics.joints[prop].static) {
            this.kinematics.setJointValue(prop, obj[prop]);
          }
        }
      }
    });
    this.kinematicsTween.start();
    setTimeout(() => {this.setupTween()}, duration);
  }

  /** Reset button click event, to remove loaded model */
  onResetBtnClicked(): void {
    this.scene.remove(this.model);
    this.modelParams.modelName = '';
    this.pane.refresh();
  }

  setToPosition(): void {
    this.kinematicsTween.start();
  }

}
