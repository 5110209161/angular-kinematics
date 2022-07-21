import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';

import { Collada, ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as TWEEN from '@tweenjs/tween.js';
import * as THREE from 'three';
import { ButtonApi, Pane } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';

import { SignalRService } from '../services/signalR.service';
import { environment } from 'src/environments/environment';
import { HttpClient } from '@angular/common/http';

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
  private modeIdList = [];
  private scaleSize: number = 6;
  private kinematics;
  private kinematicsTween;
  private tweenParameters = {};

  /** camera */
  private fieldOfView: number = 45;
  private nearClippingPane: number = 1;
  private farClippingPane: number = 2000;

  /** grid */
  private grid = new THREE.GridHelper(20, 20, 0x888888, 0x444444);

  /** helper */
  private axesHelper = new THREE.AxesHelper(10);

  /** target control */
  private posTarget = {
    joint_1: 0,
    joint_2: 0,
    joint_3: 0,
    joint_4: 0,
    joint_5: 0,
    joint_6: 0,
  };
  private duration: number = 500;  // ms

  /** panel */
  pane: Pane;
  modelParams = {
    modelName: '',
    speedRatio: 10,
    joint1: 0,
    joint2: 0,
    joint3: 0,
    joint4: 0,
    joint5: 0,
    joint6: 0,
    monitorLog: ''
  };

  constructor(
    private signalRService: SignalRService,
    private http: HttpClient
    ) { }

  ngAfterViewInit(): void {
    this.createScene();
    this.animate();
    this.createControls();
    this.createPanel();
  }

  ngOnInit(): void {
    this.initSignalService();
    this.startMockJointDataRequest();
  }

//#region Functions of building Three.js scene

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

    this.scene.add(this.axesHelper);
    
    this.initCamera();
    this.initLight();
    this.initGrid();

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
    this.pane.registerPlugin(EssentialsPlugin);

    // Tabs
    const tabs = this.pane.addTab({
      pages: [
        { title: 'Model' },
        { title: 'Control' }
      ]
    });

    // Model Tab
    tabs.pages[0].addInput(this.modelParams, 'modelName', { disabled: true, label: 'File' });

    let btnOpen = tabs.pages[0].addButton({ title: 'Open' });
    btnOpen.on('click', () => {
      document.getElementById('upload-dae-file').click();
    });

    let btnReset = tabs.pages[0].addButton({ title: 'Reset' });
    btnReset.on('click', () => {
      this.onResetBtnClicked();
    });

    tabs.pages[0].addSeparator();
    let settingFolder = tabs.pages[0].addFolder({title: 'Settings', expanded: false});
    const settingParams = {
      showAxis: true,
      showGrid: true,
      backGround: 0x000000,
      position: {x: 0, y: 0},
      monitor: ''
    };
    let btnShowAxis = settingFolder.addInput(settingParams, 'showAxis', {label: 'ShowAxis'});
    btnShowAxis.on('change', (checked) => {
      if (checked.value) {
        this.scene.add(this.axesHelper)
      } else {
        this.scene.remove(this.axesHelper);
      }
    });
    
    let btnShowGrid = settingFolder.addInput(settingParams, 'showGrid', {label: 'ShowGrid'});
    btnShowGrid.on('change', (checked) => {
      if (checked.value) {
        this.scene.add(this.grid);
      } else {
        this.scene.remove(this.grid);
      }
    });

    let bgCollorPicker = settingFolder.addInput(settingParams, 'backGround', {label: 'Background', view: 'color'});
    bgCollorPicker.on('change', (color) => {
      //let colorHex = '0x' + color.value.toString(16);
      this.scene.background = new THREE.Color(color.value);
    });

    let posPicker = settingFolder.addInput(settingParams, 'position', {
      picker: 'inline',
      expanded: true,
      x: {step: 0.1, min: -10, max: 10},
      y: {step: 0.1, min: -10, max: 10}
    });
    posPicker.on('change', (pos) => {
      let x = pos.value.x;
      let y = pos.value.y;
      if (this.model) {
        // model is not null
        if (this.scene.children.find(item => item.uuid === this.model.uuid)) {
          // model is loaded
          this.model.position.set(x, 0, y);
        }
      }
    });

    // Control Tab
    let btnCommandGroup = tabs.pages[1].addBlade({
      view: 'buttongrid',
      size: [3, 2],
      cells: (x, y) => ({
        title: [
          ['MOVE', 'ZERO', 'STOP'],
          ['POINT', 'LINE', 'SPHERE']
        ][y][x],
      }),
    }) as ButtonApi;
    btnCommandGroup.on('click', (obj) => {
      let cellIndex: Array<number> = obj['index'];
      switch (cellIndex.toString()) {
        case '0,0':
          console.log('MOVE clicked')
          break;
        case '1,0':
          console.log('ZERO clicked');
          break;
        case '2,0':
          console.log('STOP clicked');
          break;
        case '0,1':
          console.log('POINT clicked')
          break;
        case '1,1':
          console.log('LINE clicked');
          break;
        case '2,1':
          console.log('SPHERE clicked');
          break;
      }
    });

    const speedScales = [10, 20, 25, 50, 75, 100];
    let speedSlider = tabs.pages[1].addInput(this.modelParams, 'speedRatio', {
      view: 'radiogrid',
      groupName: 'speedRatio',
      size: [3, 2],
      cells: (x, y) => ({
        title: `${speedScales[y * 3 + x]}%`,
        value: speedScales[y * 3 + x],
      }),
      label: 'SpeedRatio'
    });
    speedSlider.on('change', (obj) => {
      console.log('speedRatio', obj.value)
    });

    tabs.pages[1].addSeparator();
    let joint1Pos = tabs.pages[1].addInput(this.modelParams, 'joint1', {min: -180, max: 180});
    let joint2Pos = tabs.pages[1].addInput(this.modelParams, 'joint2', {min: -180, max: 180});
    let joint3Pos = tabs.pages[1].addInput(this.modelParams, 'joint3', {min: -180, max: 180});
    let joint4Pos = tabs.pages[1].addInput(this.modelParams, 'joint4', {min: -180, max: 180});
    let joint5Pos = tabs.pages[1].addInput(this.modelParams, 'joint5', {min: -180, max: 180});
    let joint6Pos = tabs.pages[1].addInput(this.modelParams, 'joint6', {min: -180, max: 180});
    joint1Pos.on('change', (obj) => {
      this.posTarget.joint_1 = obj.value;  //TODO hard code joint name
      this.setToPosition();
    });
    joint2Pos.on('change', (obj) => {
      this.posTarget.joint_2 = obj.value;
      this.setToPosition();
    });
    joint3Pos.on('change', (obj) => {
      this.posTarget.joint_3 = obj.value;
      this.setToPosition();
    });
    joint4Pos.on('change', (obj) => {
      this.posTarget.joint_4 = obj.value;
      this.setToPosition();
    });
    joint5Pos.on('change', (obj) => {
      this.posTarget.joint_5 = obj.value;
      this.setToPosition();
    });
    joint6Pos.on('change', (obj) => {
      this.posTarget.joint_6 = obj.value;
      this.setToPosition();
    });

    tabs.pages[1].addSeparator();
    tabs.pages[1].addMonitor(this.modelParams, 'monitorLog', {multiline: true, lineCount: 10, label: 'Monitor'});
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
    // load only one model at a time
    this.modeIdList.forEach(modelId => {
      let modelLoaded = this.scene.children.find(obj => obj.uuid === modelId);
      if (modelLoaded) {
        this.scene.remove(modelLoaded);
      }
    });

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
      
      let modelId = this.model.uuid;
      this.scene.add(this.model);
      this.modeIdList.push(modelId);

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

  /** Add light into scene */
  private initLight(): void {
    let hemisohereLight = new THREE.HemisphereLight(0xffeeee, 0x111122);
    this.scene.add(hemisohereLight);
    let ambientLight = new THREE.AmbientLight(0x00000, 100);
    this.scene.add(ambientLight);
  }

  /** Add grid into scene */
  private initGrid(): void {
    this.scene.add(this.grid);
  }

  /** Setup tween */
  private setupTween(): void {
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
    this.kinematicsTween = new TWEEN.Tween(this.tweenParameters).to(this.posTarget, this.duration).easing(TWEEN.Easing.Quadratic.Out);

    this.kinematicsTween.onUpdate((obj) => {
      for (let prop in this.kinematics.joints) {
        if (this.kinematics.joints.hasOwnProperty(prop)) {
          if (!this.kinematics.joints[prop].static) {
            this.kinematics.setJointValue(prop, obj[prop]);
            this.checkJointLimit(this.kinematics.joints[prop], prop, obj[prop]);
          }
        }
      }
    });
    //this.kinematicsTween.start();
    setTimeout(() => {this.setupTween()}, this.duration);
  }

  /** Check joint limit */
  private checkJointLimit(joint, jointIndex, value): void {
    if (value > joint.limits.max || value < joint.limits.min) {
      let warnMes = `Joint: ${jointIndex} value ${value} outside of limits (min: ${joint.limits.min}, max: ${joint.limits.max})\n`;
      this.modelParams.monitorLog += warnMes;
      this.pane.refresh();
    }
  }

  /** Reset button click event, to remove loaded model */
  private onResetBtnClicked(): void {
    this.scene.remove(this.model);
    this.modelParams.modelName = '';
    this.pane.refresh();
  }

  /** Start kinematics tween */
  private setToPosition(): void {
    this.kinematicsTween.start();
  }

//#endregion


//#region Functions of real-time connection via WebSocket

  startMockJointDataRequest(): void {
    let res = this.http.get(environment.baseWSUrl + '/api/chart').subscribe(res => console.log('res', res));
  }

  initSignalService(): void {
    this.signalRService.startConnection(environment.baseWSUrl + '/chart');
    this.signalRService.addHubListener();
  }

//#endregion

}
