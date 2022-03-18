import * as cornerstone3D from '../../cornerstone-render/src/index'
import * as csTools3d from '../src/index'

import * as volumeURI_100_100_10_1_1_1_0_SEG_RectangleScissor from './groundTruth/volumeURI_100_100_10_1_1_1_0_SEG_RectangleScissor.png'
import * as volumeURI_100_100_10_1_1_1_0_SEG_SAG_RectangleScissor from './groundTruth/volumeURI_100_100_10_1_1_1_0_SEG_SAG_RectangleScissor.png'

const {
  cache,
  RenderingEngine,
  VIEWPORT_TYPE,
  ORIENTATION,
  unregisterAllImageLoaders,
  metaData,
  registerVolumeLoader,
  createAndCacheVolume,
  Utilities,
  setVolumesOnViewports,
  eventTarget,
} = cornerstone3D

const {
  ToolGroupManager,
  SegmentationDisplayTool,
  addSegmentationsForToolGroup,
  CornerstoneTools3DEvents: EVENTS,
  SegmentationModule,
  RectangleScissorsTool,
} = csTools3d

const {
  fakeVolumeLoader,
  fakeMetaDataProvider,
  createNormalizedMouseEvent,
  compareImages,
} = Utilities.testUtils

const renderingEngineUID = Utilities.uuidv4()

const viewportUID1 = 'AXIAL'
const viewportUID2 = 'SAGITTAL'

const AXIAL = 'AXIAL'
const SAGITTAL = 'SAGITTAL'

function createViewport(
  renderingEngine,
  orientation,
  viewportUID = viewportUID1
) {
  const element = document.createElement('div')

  element.style.width = '250px'
  element.style.height = '250px'
  document.body.appendChild(element)

  renderingEngine.enableElement({
    viewportUID: viewportUID,
    type: VIEWPORT_TYPE.ORTHOGRAPHIC,
    element,
    defaultOptions: {
      orientation: ORIENTATION[orientation],
      background: [1, 0, 1], // pinkish background
    },
  })
  return element
}

describe('Segmentation Tools --', () => {
  beforeAll(() => {
    cornerstone3D.setUseCPURenderingOnlyForDebugOrTests(false)
  })

  describe('Rectangle Scissor:', function () {
    beforeEach(function () {
      csTools3d.init()
      csTools3d.addTool(SegmentationDisplayTool)
      csTools3d.addTool(RectangleScissorsTool)
      cache.purgeCache()
      this.DOMElements = []

      this.segToolGroup = ToolGroupManager.createToolGroup('segToolGroup')
      this.segToolGroup.addTool(SegmentationDisplayTool.toolName)
      this.segToolGroup.addTool(RectangleScissorsTool.toolName)
      this.segToolGroup.setToolEnabled(SegmentationDisplayTool.toolName)
      this.segToolGroup.setToolActive(RectangleScissorsTool.toolName, {
        bindings: [{ mouseButton: 1 }],
      })
      this.renderingEngine = new RenderingEngine(renderingEngineUID)
      registerVolumeLoader('fakeVolumeLoader', fakeVolumeLoader)
      metaData.addProvider(fakeMetaDataProvider, 10000)
    })

    afterEach(function () {
      // Note: since on toolGroup destroy, all segmentations are removed
      // from the toolGroups, and that triggers a state_updated event, we
      // need to make sure we remove the listeners before we destroy the
      // toolGroup
      eventTarget.reset()
      csTools3d.destroy()
      cache.purgeCache()
      this.renderingEngine.destroy()
      metaData.removeProvider(fakeMetaDataProvider)
      unregisterAllImageLoaders()
      ToolGroupManager.destroyToolGroupByToolGroupUID('segToolGroup')

      this.DOMElements.forEach((el) => {
        if (el.parentNode) {
          el.parentNode.removeChild(el)
        }
      })
    })

    it('should be able to create a new segmentation from a viewport', function (done) {
      const element = createViewport(this.renderingEngine, AXIAL)
      this.DOMElements.push(element)

      // fake volume generator follows the pattern of
      const volumeId = 'fakeVolumeLoader:volumeURI_100_100_10_1_1_1_0'
      const vp = this.renderingEngine.getViewport(viewportUID1)

      eventTarget.addEventListener(
        EVENTS.SEGMENTATION_GLOBAL_STATE_MODIFIED,
        (evt) => {
          const { segmentationUID } = evt.detail
          expect(segmentationUID.includes(volumeId)).toBe(true)
        }
      )

      // wait until the render loop is done before we say done
      eventTarget.addEventListener(EVENTS.SEGMENTATION_RENDERED, (evt) => {
        done()
      })

      this.segToolGroup.addViewport(vp.uid, this.renderingEngine.uid)

      try {
        createAndCacheVolume(volumeId, { imageIds: [] }).then(() => {
          setVolumesOnViewports(
            this.renderingEngine,
            [{ volumeUID: volumeId }],
            [viewportUID1]
          ).then(() => {
            vp.render()

            SegmentationModule.createNewSegmentationForViewport(vp).then(
              (segmentationUID) => {
                addSegmentationsForToolGroup(this.segToolGroup.uid, [
                  { volumeUID: segmentationUID },
                ])
              }
            )
          })
        })
      } catch (e) {
        done.fail(e)
      }
    })

    it('should be able to edit the segmentation data with the rectangle scissor', function (done) {
      const element = createViewport(this.renderingEngine, AXIAL)
      this.DOMElements.push(element)

      // fake volume generator follows the pattern of
      const volumeId = 'fakeVolumeLoader:volumeURI_100_100_10_1_1_1_0'
      const vp = this.renderingEngine.getViewport(viewportUID1)

      const drawRectangle = () => {
        eventTarget.addEventListener(
          EVENTS.SEGMENTATION_RENDERED,
          compareImageCallback
        )

        const index1 = [11, 5, 0]
        const index2 = [80, 80, 0]

        const { imageData } = vp.getImageData()

        const {
          pageX: pageX1,
          pageY: pageY1,
          clientX: clientX1,
          clientY: clientY1,
          worldCoord: worldCoord1,
        } = createNormalizedMouseEvent(imageData, index1, element, vp)

        const {
          pageX: pageX2,
          pageY: pageY2,
          clientX: clientX2,
          clientY: clientY2,
          worldCoord: worldCoord2,
        } = createNormalizedMouseEvent(imageData, index2, element, vp)

        // Mouse Down
        let evt = new MouseEvent('mousedown', {
          target: element,
          buttons: 1,
          clientX: clientX1,
          clientY: clientY1,
          pageX: pageX1,
          pageY: pageY1,
        })
        element.dispatchEvent(evt)

        // Mouse move to put the end somewhere else
        evt = new MouseEvent('mousemove', {
          target: element,
          buttons: 1,
          clientX: clientX2,
          clientY: clientY2,
          pageX: pageX2,
          pageY: pageY2,
        })
        document.dispatchEvent(evt)

        // Mouse Up instantly after
        evt = new MouseEvent('mouseup')

        document.dispatchEvent(evt)
      }

      const newSegRenderedCallback = () => {
        eventTarget.removeEventListener(
          EVENTS.SEGMENTATION_RENDERED,
          newSegRenderedCallback
        )

        // Since we need some time after the first render so that the
        // request animation frame is done and is ready for the next frame.
        setTimeout(() => {
          drawRectangle()
        }, 500)
      }

      const compareImageCallback = () => {
        const canvas = vp.getCanvas()
        const image = canvas.toDataURL('image/png')

        compareImages(
          image,
          volumeURI_100_100_10_1_1_1_0_SEG_RectangleScissor,
          'volumeURI_100_100_10_1_1_1_0_SEG_RectangleScissor'
        ).then(done, done.fail)
      }

      eventTarget.addEventListener(
        EVENTS.SEGMENTATION_RENDERED,
        newSegRenderedCallback
      )

      eventTarget.addEventListener(
        EVENTS.SEGMENTATION_GLOBAL_STATE_MODIFIED,
        (evt) => {
          const { segmentationUID } = evt.detail
          expect(segmentationUID.includes(volumeId)).toBe(true)
        }
      )

      this.segToolGroup.addViewport(vp.uid, this.renderingEngine.uid)

      try {
        createAndCacheVolume(volumeId, { imageIds: [] }).then(() => {
          setVolumesOnViewports(
            this.renderingEngine,
            [{ volumeUID: volumeId }],
            [viewportUID1]
          ).then(() => {
            vp.render()

            SegmentationModule.createNewSegmentationForViewport(vp).then(
              (segmentationUID) => {
                addSegmentationsForToolGroup(this.segToolGroup.uid, [
                  { volumeUID: segmentationUID },
                ])
              }
            )
          })
        })
      } catch (e) {
        done.fail(e)
      }
    })

    it('should be able to edit the segmentation data with the rectangle scissor with two viewports to render', function (done) {
      const element1 = createViewport(this.renderingEngine, AXIAL)
      const element2 = createViewport(
        this.renderingEngine,
        SAGITTAL,
        viewportUID2
      )
      this.DOMElements.push(element1)
      this.DOMElements.push(element2)

      // fake volume generator follows the pattern of
      const volumeId = 'fakeVolumeLoader:volumeURI_100_100_10_1_1_1_0'
      const vp1 = this.renderingEngine.getViewport(viewportUID1)
      const vp2 = this.renderingEngine.getViewport(viewportUID2)

      const drawRectangle = () => {
        eventTarget.removeEventListener(
          EVENTS.SEGMENTATION_RENDERED,
          drawRectangle
        )
        eventTarget.addEventListener(
          EVENTS.SEGMENTATION_RENDERED,
          compareImageCallback
        )

        const index1 = [11, 5, 0]
        const index2 = [80, 80, 0]

        const { imageData } = vp1.getImageData()

        const {
          pageX: pageX1,
          pageY: pageY1,
          clientX: clientX1,
          clientY: clientY1,
          worldCoord: worldCoord1,
        } = createNormalizedMouseEvent(imageData, index1, element1, vp1)

        const {
          pageX: pageX2,
          pageY: pageY2,
          clientX: clientX2,
          clientY: clientY2,
          worldCoord: worldCoord2,
        } = createNormalizedMouseEvent(imageData, index2, element1, vp1)

        // Mouse Down
        let evt = new MouseEvent('mousedown', {
          target: element1,
          buttons: 1,
          clientX: clientX1,
          clientY: clientY1,
          pageX: pageX1,
          pageY: pageY1,
        })
        element1.dispatchEvent(evt)

        // Mouse move to put the end somewhere else
        evt = new MouseEvent('mousemove', {
          target: element1,
          buttons: 1,
          clientX: clientX2,
          clientY: clientY2,
          pageX: pageX2,
          pageY: pageY2,
        })
        document.dispatchEvent(evt)

        // Mouse Up instantly after
        evt = new MouseEvent('mouseup')

        document.dispatchEvent(evt)
      }

      let newSegRenderCount = 0
      const newSegRenderedCallback = () => {
        newSegRenderCount++

        if (newSegRenderCount !== 2) {
          return
        }

        eventTarget.removeEventListener(
          EVENTS.SEGMENTATION_RENDERED,
          newSegRenderedCallback
        )

        // Since we need some time after the first render so that the
        // request animation frame is done and is ready for the next frame.
        setTimeout(() => {
          drawRectangle()
        }, 500)
      }

      let compareCount = 0
      const compareImageCallback = () => {
        compareCount++

        // since we are triggering segmentationRendered on each element,
        // until both are rendered, we should not be comparing the images
        if (compareCount !== 2) {
          return
        }

        const canvas1 = vp1.getCanvas()
        const canvas2 = vp2.getCanvas()

        const image1 = canvas1.toDataURL('image/png')
        const image2 = canvas2.toDataURL('image/png')

        compareImages(
          image1,
          volumeURI_100_100_10_1_1_1_0_SEG_RectangleScissor,
          'volumeURI_100_100_10_1_1_1_0_SEG_RectangleScissor'
        )

        compareImages(
          image2,
          volumeURI_100_100_10_1_1_1_0_SEG_SAG_RectangleScissor,
          'volumeURI_100_100_10_1_1_1_0_SEG_SAG_RectangleScissor'
        ).then(done, done.fail)
      }

      eventTarget.addEventListener(
        EVENTS.SEGMENTATION_RENDERED,
        newSegRenderedCallback
      )

      eventTarget.addEventListener(
        EVENTS.SEGMENTATION_GLOBAL_STATE_MODIFIED,
        (evt) => {
          const { segmentationUID } = evt.detail
          expect(segmentationUID.includes(volumeId)).toBe(true)
        }
      )

      this.segToolGroup.addViewport(vp1.uid, this.renderingEngine.uid)
      this.segToolGroup.addViewport(vp2.uid, this.renderingEngine.uid)

      try {
        createAndCacheVolume(volumeId, { imageIds: [] }).then(() => {
          setVolumesOnViewports(
            this.renderingEngine,
            [{ volumeUID: volumeId }],
            [viewportUID1, viewportUID2]
          ).then(() => {
            vp1.render()
            vp2.render()

            SegmentationModule.createNewSegmentationForViewport(vp1).then(
              (segmentationUID) => {
                addSegmentationsForToolGroup(this.segToolGroup.uid, [
                  { volumeUID: segmentationUID },
                ])
              }
            )
          })
        })
      } catch (e) {
        done.fail(e)
      }
    })
  })
})