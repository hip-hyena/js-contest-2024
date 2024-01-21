/*
 * https://github.com/morethanwords/tweb
 * Copyright (C) 2019-2021 Eduard Kuzmenko
 * https://github.com/morethanwords/tweb/blob/master/LICENSE
 */

import {IS_SAFARI} from '../../environment/userAgent';
import {IS_H265_SUPPORTED} from '../../environment/videoSupport';
import {animateSingle} from '../../helpers/animation';
import {ChatAutoDownloadSettings} from '../../helpers/autoDownload';
import deferredPromise from '../../helpers/cancellablePromise';
import cancelEvent from '../../helpers/dom/cancelEvent';
import {attachClickEvent} from '../../helpers/dom/clickEvent';
import createVideo from '../../helpers/dom/createVideo';
import handleVideoLeak from '../../helpers/dom/handleVideoLeak';
import isInDOM from '../../helpers/dom/isInDOM';
import renderImageFromUrl from '../../helpers/dom/renderImageFromUrl';
import safePlay from '../../helpers/dom/safePlay';
import setCurrentTime from '../../helpers/dom/setCurrentTime';
import getMediaThumbIfNeeded from '../../helpers/getStrippedThumbIfNeeded';
import liteMode from '../../helpers/liteMode';
import makeError from '../../helpers/makeError';
import mediaSizes, {ScreenSize} from '../../helpers/mediaSizes';
import {Middleware} from '../../helpers/middleware';
import noop from '../../helpers/noop';
import onMediaLoad, {shouldIgnoreVideoError} from '../../helpers/onMediaLoad';
import {fastRaf} from '../../helpers/schedulers';
import throttle from '../../helpers/schedulers/throttle';
import sequentialDom from '../../helpers/sequentialDom';
import toHHMMSS from '../../helpers/string/toHHMMSS';
import {Message, PhotoSize, VideoSize} from '../../layer';
import {MyDocument} from '../../lib/appManagers/appDocsManager';
import appDownloadManager from '../../lib/appManagers/appDownloadManager';
import appImManager from '../../lib/appManagers/appImManager';
import {AppManagers} from '../../lib/appManagers/managers';
import {NULL_PEER_ID} from '../../lib/mtproto/mtproto_config';
import apiManagerProxy from '../../lib/mtproto/mtprotoworker';
import rootScope from '../../lib/rootScope';
import {ThumbCache} from '../../lib/storages/thumbs';
import animationIntersector, {AnimationItemGroup} from '../animationIntersector';
import appMediaPlaybackController, {MediaSearchContext} from '../appMediaPlaybackController';
import AudioElement, {findMediaTargets} from '../audio';
import Button from '../button';
import Icon from '../icon';
import LazyLoadQueue from '../lazyLoadQueue';
import ProgressivePreloader from '../preloader';
import wrapPhoto from './photo';
import patchVideo from '../../helpers/videoPatcher';

const MAX_VIDEO_AUTOPLAY_SIZE = 50 * 1024 * 1024; // 50 MB

let roundVideoCircumference = 0;
mediaSizes.addEventListener('changeScreen', (from, to) => {
  if(to === ScreenSize.mobile || from === ScreenSize.mobile) {
    const elements = Array.from(document.querySelectorAll('.media-round .progress-ring')) as SVGSVGElement[];
    const width = mediaSizes.active.round.width;
    const halfSize = width / 2;
    const radius = halfSize - 7;
    roundVideoCircumference = 2 * Math.PI * radius;
    elements.forEach((element) => {
      element.setAttributeNS(null, 'width', '' + width);
      element.setAttributeNS(null, 'height', '' + width);

      const circle = element.firstElementChild as SVGCircleElement;
      circle.setAttributeNS(null, 'cx', '' + halfSize);
      circle.setAttributeNS(null, 'cy', '' + halfSize);
      circle.setAttributeNS(null, 'r', '' + radius);

      circle.style.strokeDasharray = roundVideoCircumference + ' ' + roundVideoCircumference;
      circle.style.strokeDashoffset = '' + roundVideoCircumference;
    });
  }
});

export default async function wrapVideo({doc, altDoc, container, message, boxWidth, boxHeight, withTail, isOut, middleware, lazyLoadQueue, noInfo, group, onlyPreview, noPreview, withoutPreloader, loadPromises, noPlayButton, photoSize, videoSize, searchContext, autoDownload, managers = rootScope.managers, noAutoplayAttribute, ignoreStreaming, canAutoplay, useBlur}: {
  doc: MyDocument,
  altDoc?: MyDocument,
  container?: HTMLElement,
  message?: Message.message,
  boxWidth?: number,
  boxHeight?: number,
  withTail?: boolean,
  isOut?: boolean,
  middleware?: Middleware,
  lazyLoadQueue?: LazyLoadQueue,
  noInfo?: boolean,
  noPlayButton?: boolean,
  group?: AnimationItemGroup,
  onlyPreview?: boolean,
  noPreview?: boolean,
  withoutPreloader?: boolean,
  loadPromises?: Promise<any>[],
  autoDownload?: ChatAutoDownloadSettings,
  photoSize?: PhotoSize,
  videoSize?: Extract<VideoSize, VideoSize.videoSize>,
  searchContext?: MediaSearchContext,
  managers?: AppManagers,
  noAutoplayAttribute?: boolean,
  ignoreStreaming?: boolean,
  canAutoplay?: boolean,
  useBlur?: boolean | number,
}) {
  const supportsStreaming = doc.supportsStreaming && !ignoreStreaming;
  if(!supportsStreaming && altDoc && !onlyPreview && !IS_H265_SUPPORTED) {
    doc = altDoc;
    altDoc = undefined;
  }

  const autoDownloadSize = autoDownload?.video;
  let noAutoDownload = autoDownloadSize === 0;
  const isAlbumItem = !(boxWidth && boxHeight);
  canAutoplay ??= /* doc.sticker ||  */(
    (
      doc.type !== 'video' || (
        doc.size <= MAX_VIDEO_AUTOPLAY_SIZE &&
        !isAlbumItem
      )
    ) && (doc.type === 'gif' ? liteMode.isAvailable('gif') : liteMode.isAvailable('video'))
  );
  let spanTime: HTMLElement, spanPlay: HTMLElement;

  if(!noInfo && container) {
    spanTime = document.createElement('span');
    spanTime.classList.add('video-time');
    container.append(spanTime);

    let needPlayButton = false;
    if(doc.type !== 'gif') {
      spanTime.innerText = toHHMMSS(doc.duration, false);

      if(!noPlayButton && doc.type !== 'round') {
        if(canAutoplay && !noAutoDownload) {
          spanTime.classList.add('can-autoplay');
          spanTime.append(Icon('nosound', 'video-time-icon'));
        } else {
          needPlayButton = true;
        }
      }
    } else {
      spanTime.innerText = 'GIF';

      if(!canAutoplay && !noPlayButton) {
        needPlayButton = true;
        noAutoDownload = undefined;
      }
    }

    if(needPlayButton) {
      spanPlay = Button('btn-circle video-play position-center', {icon: 'largeplay', noRipple: true});
      container.append(spanPlay);
    }
  }

  const res: {
    thumb?: typeof photoRes,
    video?: HTMLVideoElement,
    loadPromise: Promise<any>
  } = {} as any;

  if(doc.mime_type === 'image/gif') {
    const photoRes = await wrapPhoto({
      photo: doc,
      message,
      container,
      boxWidth,
      boxHeight,
      withTail,
      isOut,
      lazyLoadQueue,
      middleware,
      withoutPreloader,
      loadPromises,
      autoDownloadSize,
      size: photoSize,
      managers,
      useBlur
    });

    res.thumb = photoRes;
    res.loadPromise = photoRes.loadPromises.full;
    return res;
  }

  /* const video = doc.type === 'round' ? appMediaPlaybackController.addMedia(doc, message.mid) as HTMLVideoElement : document.createElement('video');
  if(video.parentElement) {
    video.remove();
  } */

  let preloader: ProgressivePreloader; // it must be here, otherwise will get error before initialization in round onPlay

  const video = createVideo({middleware});
  video.classList.add('media-video');
  video.muted = true;
  if(doc.type === 'round') {
    const divRound = document.createElement('div');
    divRound.classList.add('media-round', 'z-depth-1');
    divRound.dataset.mid = '' + message.mid;
    divRound.dataset.peerId = '' + message.peerId;
    (divRound as any).message = message;

    const size = mediaSizes.active.round;
    const halfSize = size.width / 2;
    const strokeWidth = 3.5;
    const radius = halfSize - (strokeWidth * 2);
    divRound.innerHTML = `<svg class="progress-ring" width="${size.width}" height="${size.width}" style="transform: rotate(-90deg);">
      <circle class="progress-ring__circle" stroke="white" stroke-opacity="0.3" stroke-width="${strokeWidth}" cx="${halfSize}" cy="${halfSize}" r="${radius}" fill="transparent"/>
    </svg>`;

    const circle = divRound.firstElementChild.firstElementChild as SVGCircleElement;
    if(!roundVideoCircumference) {
      roundVideoCircumference = 2 * Math.PI * radius;
    }
    circle.style.strokeDasharray = roundVideoCircumference + ' ' + roundVideoCircumference;
    circle.style.strokeDashoffset = '' + roundVideoCircumference;

    const isUnread = message.pFlags.media_unread;
    if(isUnread) {
      divRound.classList.add('is-unread');
    }

    const canvas = document.createElement('canvas');
    canvas.classList.add('video-round-canvas');
    canvas.width = canvas.height = doc.w/*  * window.devicePixelRatio */;

    divRound.prepend(canvas, spanTime);
    divRound.append(video);
    container?.append(divRound);

    const ctx = canvas.getContext('2d');
    /* ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
    ctx.clip(); */

    const onLoad = () => {
      const message: Message.message = (divRound as any).message;
      const globalVideo = appMediaPlaybackController.addMedia(message, !noAutoDownload) as HTMLVideoElement;
      const clear = () => {
        (appImManager.chat.setPeerPromise || Promise.resolve()).finally(() => {
          if(isInDOM(globalVideo)) {
            return;
          }

          globalVideo.removeEventListener('play', onPlay);
          globalVideo.removeEventListener('timeupdate', throttledTimeUpdate);
          globalVideo.removeEventListener('pause', onPaused);
          globalVideo.removeEventListener('ended', onEnded);
        });
      };

      const onFrame = () => {
        ctx.drawImage(globalVideo, 0, 0);

        const offset = roundVideoCircumference - globalVideo.currentTime / globalVideo.duration * roundVideoCircumference;
        circle.style.strokeDashoffset = '' + offset;

        return !globalVideo.paused;
      };

      const onTimeUpdate = () => {
        if(!globalVideo.duration) {
          return;
        }

        if(!isInDOM(globalVideo)) {
          clear();
          return;
        }

        if(globalVideo.paused) {
          onFrame();
        }

        spanTime.firstChild.nodeValue = toHHMMSS(globalVideo.duration - globalVideo.currentTime, false);
      };

      const throttledTimeUpdate = throttle(() => {
        fastRaf(onTimeUpdate);
      }, 1000, false);

      const noSoundIcon = Icon('nosound', 'video-time-icon');
      const setIsPaused = (paused: boolean) => {
        divRound.classList.toggle('is-paused', paused);
        if(paused) {
          spanTime.append(noSoundIcon);
        } else {
          noSoundIcon.remove();
        }
      };

      const onPlay = () => {
        video.classList.add('hide');
        setIsPaused(false);
        animateSingle(onFrame, canvas);

        if(preloader?.preloader && preloader.preloader.classList.contains('manual')) {
          preloader.onClick();
        }
      };

      const onPaused = () => {
        if(!isInDOM(globalVideo)) {
          clear();
          return;
        }

        setIsPaused(true);
      };

      const onEnded = () => {
        video.classList.remove('hide');
        setIsPaused(true);

        setCurrentTime(video, 0);
        spanTime.firstChild.nodeValue = toHHMMSS(globalVideo.duration, false);

        if(globalVideo.currentTime) {
          setCurrentTime(globalVideo, 0);
        }
      };

      globalVideo.addEventListener('play', onPlay);
      globalVideo.addEventListener('timeupdate', throttledTimeUpdate);
      globalVideo.addEventListener('pause', onPaused);
      globalVideo.addEventListener('ended', onEnded);

      attachClickEvent(canvas, (e) => {
        cancelEvent(e);

        // ! костыль
        if(preloader && !preloader.detached) {
          preloader.onClick();
        }

        // ! can't use it here. on Safari iOS video won't start.
        /* if(globalVideo.readyState < 2) {
          return;
        } */

        if(globalVideo.paused) {
          const hadSearchContext = !!searchContext;
          if(appMediaPlaybackController.setSearchContext(searchContext || {
            peerId: NULL_PEER_ID,
            inputFilter: {_: 'inputMessagesFilterEmpty'},
            useSearch: false
          })) {
            const [prev, next] = !hadSearchContext ? [] : findMediaTargets(divRound, message.mid/* , searchContext.useSearch */);
            appMediaPlaybackController.setTargets({peerId: message.peerId, mid: message.mid}, prev, next);
          }

          safePlay(globalVideo);
        } else {
          globalVideo.pause();
        }
      });

      if(globalVideo.paused) {
        if(globalVideo.duration && globalVideo.currentTime !== globalVideo.duration && globalVideo.currentTime > 0) {
          onFrame();
          onTimeUpdate();
          video.classList.add('hide');
        } else {
          onPaused();
        }
      } else {
        onPlay();
      }
    };

    if(message.pFlags.is_outgoing) {
      // ! WARNING ! just to type-check
      (divRound as any as AudioElement).onLoad = onLoad;
      divRound.dataset.isOutgoing = '1';
    } else {
      onLoad();
    }
  } else if(!noAutoplayAttribute) {
    video.autoplay = true; // для safari
  }

  let photoRes: Awaited<ReturnType<typeof wrapPhoto>>;
  if(message || onlyPreview) {
    photoRes = await wrapPhoto({
      photo: doc,
      message,
      container,
      boxWidth,
      boxHeight,
      withTail,
      isOut,
      lazyLoadQueue,
      middleware,
      withoutPreloader: true,
      loadPromises,
      autoDownloadSize: autoDownload?.photo,
      size: photoSize,
      managers,
      useBlur
    });

    res.thumb = photoRes;

    if((!canAutoplay && doc.type !== 'gif') || onlyPreview) {
      res.loadPromise = photoRes.loadPromises.full;
      return res;
    }

    if(withTail) {
      const foreignObject = (photoRes.images.thumb || photoRes.images.full).parentElement;
      video.width = +foreignObject.getAttributeNS(null, 'width');
      video.height = +foreignObject.getAttributeNS(null, 'height');
      foreignObject.append(video);
    }
  } else if(!noPreview) { // * gifs masonry
    const gotThumb = getMediaThumbIfNeeded({
      photo: doc,
      cacheContext: {} as ThumbCache,
      useBlur: useBlur || true
    });
    if(gotThumb) {
      const thumbImage = gotThumb.image;
      thumbImage.classList.add('media-poster');
      container?.append(thumbImage);
      res.thumb = {
        loadPromises: {
          thumb: gotThumb.loadPromise,
          full: Promise.resolve()
        },
        images: {
          thumb: thumbImage,
          full: null
        },
        preloader: null,
        aspecter: null
      };

      loadPromises?.push(gotThumb.loadPromise);
      res.loadPromise = gotThumb.loadPromise;
    }
  }

  if(onlyPreview) {
    return res;
  }

  // ! do not append before load or will get `URL safety check` error
  const appendVideo = () => {
    (photoRes?.aspecter || container).append(video);
  };

  if(!video.parentElement && container && video.poster/*  && !altDoc */) {
    appendVideo();
  }

  let cacheContext: ThumbCache, altCacheContext: ThumbCache;
  const getCacheContext = () => {
    cacheContext = apiManagerProxy.getCacheContext(doc, videoSize?.type);
    altDoc && (altCacheContext = apiManagerProxy.getCacheContext(altDoc, videoSize?.type));
  };

  getCacheContext();

  const uploadFileName = message?.uploadingFileName;
  if(uploadFileName) { // means upload
    preloader = new ProgressivePreloader({
      attachMethod: 'prepend',
      isUpload: true
    });
    preloader.attachPromise(appDownloadManager.getUpload(uploadFileName));
    preloader.attach(container, false);
    noAutoDownload = undefined;
  } else if(!cacheContext.downloaded && !supportsStreaming && !withoutPreloader) {
    preloader = new ProgressivePreloader({
      attachMethod: 'prepend'
    });
  } else if(supportsStreaming && !withoutPreloader) {
    preloader = new ProgressivePreloader({
      cancelable: false,
      attachMethod: 'prepend'
    });
  }

  const renderDeferred = deferredPromise<void>();
  video.addEventListener('error', (e) => {
    if(shouldIgnoreVideoError(e)) {
      return;
    }

    if(video.error.code !== 4) {
      console.error('Error ' + video.error.code + '; details: ' + video.error.message);
    }

    if(preloader && !uploadFileName) {
      preloader.detach();
    }

    if(!renderDeferred.isFulfilled) {
      renderDeferred.resolve();
    }
  }, {once: true});

  if(doc.type === 'video' && spanTime) {
    const onTimeUpdate = () => {
      if(!video.duration) {
        return;
      }

      spanTime.firstChild.nodeValue = toHHMMSS(video.duration - video.currentTime, false);
    };

    const throttledTimeUpdate = throttle(() => {
      fastRaf(onTimeUpdate);
    }, 1e3, false);

    video.addEventListener('timeupdate', throttledTimeUpdate);

    if(spanPlay) {
      video.addEventListener('timeupdate', () => {
        sequentialDom.mutateElement(spanPlay, () => {
          spanPlay.remove();
        });
      }, {once: true});
    }
  }

  video.muted = true;
  video.loop = true;
  // video.play();
  if(!noAutoplayAttribute) {
    video.autoplay = true;
  }

  let loadPhotoThumbFunc = noAutoDownload && photoRes?.preloader?.loadFunc;
  const load = async() => {
    if(preloader && noAutoDownload && !withoutPreloader) {
      preloader.construct();
      preloader.setManual();
    }

    getCacheContext();
    let loadPromise: Promise<any> = Promise.resolve();
    if((preloader && !uploadFileName) || withoutPreloader) {
      if(!cacheContext.downloaded && !supportsStreaming) {
        const promise = loadPromise = appDownloadManager.downloadMediaURL({
          media: doc,
          queueId: lazyLoadQueue?.queueId,
          onlyCache: noAutoDownload,
          thumb: videoSize
        });

        if(preloader) {
          preloader.attach(container, false, promise);
        }
      } else if(supportsStreaming) {
        if(noAutoDownload) {
          loadPromise = Promise.reject(makeError('NO_AUTO_DOWNLOAD'));
        } else if(!cacheContext.downloaded && preloader) { // * check for uploading video
          preloader.attach(container, false, null);
          video.addEventListener(IS_SAFARI ? 'timeupdate' : 'canplay', () => {
            preloader.detach();
          }, {once: true});
        }
      }
    }

    if(!noAutoDownload && loadPhotoThumbFunc) {
      loadPhotoThumbFunc();
      loadPhotoThumbFunc = null;
    }

    noAutoDownload = undefined;

    loadPromise.then(async() => {
      if(middleware && !middleware()) {
        renderDeferred.resolve();
        return;
      }

      if(doc.type === 'round') {
        appMediaPlaybackController.resolveWaitingForLoadMedia(message.peerId, message.mid, message.pFlags.is_scheduled);
      }

      getCacheContext();

      const onError = (err: any) => {
        console.error('video load error', video, err);
        if(spanTime) {
          spanTime.classList.add('is-error');
          const previousIcon = spanTime.querySelector('.video-time-icon');
          const newIcon = Icon('sendingerror', 'video-time-icon');
          if(previousIcon) previousIcon.replaceWith(newIcon);
          else spanTime.append(newIcon);
        }
        renderDeferred.reject(err);
      };
      const onMediaLoadPromise = onMediaLoad(video).catch(async(err: any) => {
        if(err && err.message == 'DECODER_ERROR_NOT_SUPPORTED: Audio configuration specified 2 channels, but FFmpeg thinks the file contains 1 channels') {
          // Workaround for Chromium AAC bug:
          // https://bugs.chromium.org/p/chromium/issues/detail?id=1250841
          //
          // TODO: To improve performance, this probably should be done in Service Worker
          const patched = await patchVideo(cacheContext.url);
          if(!patched) { // Was unable to patch video, just rethrow the original error
            throw err;
          }
          const blobUrl = URL.createObjectURL(new Blob([patched]));
          video.src = blobUrl;
          return onMediaLoad(video);
        } else {
          throw err;
        }
      });
      const videoLeakPromise = handleVideoLeak(video, onMediaLoadPromise);
      videoLeakPromise.catch(onError);
      onMediaLoadPromise.then(() => {
        if(group) {
          animationIntersector.addAnimation({
            animation: video,
            group,
            observeElement: video,
            type: 'video'
          });
        }

        if(preloader && !uploadFileName) {
          preloader.detach();
        }

        if(!video.parentElement && container && !video.poster/*  && !altDoc */) {
          appendVideo();
        }

        if(altDoc) {
          videoLeakPromise.then(() => {
            video.pause();
            renderDeferred.resolve();
          });
          setCurrentTime(video, 0.0001);
        } else {
          renderDeferred.resolve();
        }
      }, onError);

      if(altDoc && altCacheContext) {
        const sources = [
          {context: cacheContext, type: 'video/mp4; codecs="hev1"', width: doc.w},
          {context: altCacheContext, type: 'video/mp4; codecs="avc1.64001E"', width: altDoc.w}
        ].map(({context, type, width}) => {
          const source = document.createElement('source');
          source.src = context.url;
          // source.type = type;
          source.width = width;
          return source;
        });

        video.append(...sources);
        video.load();
      } else {
        renderImageFromUrl(video, cacheContext.url);
      }
    }, noop);

    return {download: loadPromise, render: Promise.all([loadPromise, renderDeferred])};
  };

  if(preloader && !uploadFileName) {
    preloader.setDownloadFunction(load);
  }

  container && ((container as any).preloader = preloader);

  if(doc.type === 'gif' && !canAutoplay) {
    attachClickEvent(container, (e) => {
      cancelEvent(e);
      spanPlay.remove();
      load();
    }, {capture: true, once: true});
  } else {
    res.loadPromise = !lazyLoadQueue ?
      (await load()).render :
      (lazyLoadQueue.push({div: container, load: () => load().then(({render}) => render)}), Promise.resolve());
  }

  if(res.thumb) {
    await res.thumb.loadPromises.thumb;
  }

  if(video) {
    res.video = video;
  }

  return res;
}
