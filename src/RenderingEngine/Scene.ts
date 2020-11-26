// @ts-ignore
import Viewport, { ViewportInterface } from './Viewport.ts';
// @ts-ignore
import renderingEngineCache from './renderingEngineCache.ts';
// @ts-ignore
import RenderingEngine from './RenderingEngine.ts';
import { createVolumeActor } from './helpers';

/**
 * @type VolumeActorEntry
 * Defines the shape of volume actors entries added to the scene.
 */
export type VolumeActorEntry = {
  uid: string;
  volumeActor: object;
  slabThickness: number;
};

/**
 * @interface SceneViewportsAPI Defines the public API returned when calling `getViewports()`.
 */
interface SceneViewportsAPI {
  viewports: Array<Viewport>;
  setToolGroup: Function;
  setSyncGroups: Function;
}

type VolumeInput = {
  volumeUID: string;
  callback?: Function;
  blendMode?: string;
  slabThickness?: number;
};

type ViewportInput = {
  uid: string;
  type: string;
  canvas: HTMLElement;
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
  defaultOptions: any;
};

/**
 * @class Scene - Describes a scene which defined a worldspace containing actors.
 * A scene may have different viewports which may be different views of this same data.
 */
class Scene {
  readonly uid: string;
  readonly renderingEngineUID: string;
  private _viewports: Array<Viewport>;
  private _volumeActors: Array<VolumeActorEntry>;

  constructor(uid, renderingEngineUID) {
    this.uid = uid;
    this.renderingEngineUID = renderingEngineUID;
    this._viewports = [];
    this._volumeActors = [];
  }

  /**
   * @method getRenderingEngine Returns the rendering engine driving the `Scene`.
   *
   * @returns {RenderingEngine} The RenderingEngine instance.
   */
  public getRenderingEngine(): RenderingEngine {
    return renderingEngineCache.get(this.renderingEngineUID);
  }

  /**
   * @method getViewports Returns a public api to perfom bulk operation on
   * the `Scene`'s `Viewport`s.
   *
   * @returns {SceneViewportsAPI} The api.
   */
  public getViewports(): SceneViewportsAPI {
    return {
      viewports: this._viewports,
      setToolGroup: toolGroupUID => {
        this._viewports.forEach(viewport => {
          viewport.setToolGroup(toolGroupUID);
        });
      },
      setSyncGroups: (syncGroupUIDs = []) => {
        this._viewports.forEach(viewport => {
          viewport.setSyncGroups(syncGroupUIDs);
        });
      },
    };
  }

  /**
   * @method render Renders all `Viewport`s in the `Scene` using the `Scene`'s `RenderingEngine`.
   */
  public render() {
    const renderingEngine = this.getRenderingEngine();

    renderingEngine.renderScene(this.uid);
  }

  /**
   * @method getViewport - Returns a `Viewport` from the `Scene` by its `uid`.
   * @param {string } uid The UID of the viewport to get.
   */
  public getViewport(uid: string): Viewport {
    return this._viewports.find(vp => vp.uid === uid);
  }

  /**
   * @method setVolumes Creates volume actors for all volumes defined in the `volumeInputArray`.
   * For each entry, if a `callback` is supplied, it will be called with the new volume actor as input.
   * For each entry, if a `blendMode` and/or `slabThickness` is defined, this will be set on the actor's
   * `VolumeMapper`.
   *
   * @param {Array<VolumeInput>} volumeInputArray The array of `VolumeInput`s which define the volumes to add.
   * @param {boolean} [immediate=false] Whether the `Scene` should be rendered as soon as volumes are added.
   */
  public setVolumes(
    volumeInputArray: Array<VolumeInput>,
    immediate: boolean = false
  ) {
    this._volumeActors = [];

    const slabThicknessValues = [];

    for (let i = 0; i < volumeInputArray.length; i++) {
      const { volumeUID, slabThickness } = volumeInputArray[i];
      const volumeActor = createVolumeActor(volumeInputArray[i]);

      this._volumeActors.push({ volumeActor, uid: volumeUID, slabThickness });

      if (
        slabThickness !== undefined &&
        !slabThicknessValues.includes(slabThickness)
      ) {
        slabThicknessValues.push(slabThickness);
      }
    }

    if (slabThicknessValues.length > 1) {
      console.warn(
        'Currently slab thickness for intensity projections is tied to the camera, not per volume, using the largest of the two volumes for this scene.'
      );
    }

    this._viewports.forEach(viewport => {
      viewport._setVolumeActors(this._volumeActors);
    });

    if (immediate) {
      this.render();
    }
  }

  /**
   * @method addViewport Adds a `Viewport` to the `Scene`, as defined by the `ViewportInput`.
   * @param {ViewportInput} viewportInput
   */
  public addViewport(viewportInput: ViewportInput) {
    const viewportInterface = <ViewportInterface>Object.assign(
      {},
      viewportInput,
      {
        sceneUID: this.uid,
        renderingEngineUID: this.renderingEngineUID,
      }
    );

    const viewport = new Viewport(viewportInterface);

    this._viewports.push(viewport);
  }

  /**
   * @method getVolumeActor Gets a volume actor on the scene by its `uid`.
   *
   * @param {string }uid The UID of the volumeActor to fetch.
   * @returns {object} The volume actor.
   */
  public getVolumeActor(uid: string): object {
    const volumeActors = this._volumeActors;

    const volumeActorEntry = volumeActors.find(va => va.uid === uid);

    if (volumeActorEntry) {
      return volumeActorEntry.volumeActor;
    }
  }

  /**
   * @method getVolumeActors Gets the array of `VolumeActorEntry`s.
   *
   * @returns {Array<VolumeActorEntry>} The array of volume actors.
   */
  public getVolumeActors(): Array<VolumeActorEntry> {
    return [...this._volumeActors];
  }
}

export default Scene;