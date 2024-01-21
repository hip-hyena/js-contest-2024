import PopupElement from '.';
import {hexToRgb} from '../../helpers/color';
import {attachClickEvent} from '../../helpers/dom/clickEvent';
import customProperties from '../../helpers/dom/customProperties';
import {Chat, GroupCall, GroupCallParticipant, InputGroupCall} from '../../layer';
import type {AppChatsManager} from '../../lib/appManagers/appChatsManager';
import type {AppGroupCallsManager} from '../../lib/appManagers/appGroupCallsManager';
import type {AppPeersManager} from '../../lib/appManagers/appPeersManager';
import GROUP_CALL_STATE from '../../lib/calls/groupCallState';
import {RLottieColor} from '../../lib/rlottie/rlottiePlayer';
import rootScope from '../../lib/rootScope';
import ButtonIcon from '../buttonIcon';
import PopupPeer from './peer';
import {addFullScreenListener, cancelFullScreen, isFullScreen, requestFullScreen} from '../../helpers/dom/fullScreen';
import Scrollable from '../scrollable';
import {MovableState} from '../movableElement';
import animationIntersector from '../animationIntersector';
import {IS_APPLE_MOBILE, IS_SAFARI} from '../../environment/userAgent';
import throttle from '../../helpers/schedulers/throttle';
import IS_SCREEN_SHARING_SUPPORTED from '../../environment/screenSharingSupport';
import GroupCallInstance from '../../lib/calls/groupCallInstance';
import makeButton from '../call/button';
import MovablePanel from '../../helpers/movablePanel';
import findUpClassName from '../../helpers/dom/findUpClassName';
import safeAssign from '../../helpers/object/safeAssign';
import toggleClassName from '../../helpers/toggleClassName';
import {AppManagers} from '../../lib/appManagers/managers';
import themeController from '../../helpers/themeController';
import groupCallsController from '../../lib/calls/groupCallsController';
import {avatarNew, findUpAvatar} from '../avatarNew';
import {MiddlewareHelper, getMiddleware} from '../../helpers/middleware';
import {i18n} from '../../lib/langPack';
import wrapPeerTitle from '../wrappers/peerTitle';
import wrapEmojiText from '../../lib/richTextProcessor/wrapEmojiText';
import {NULL_PEER_ID} from '../../lib/mtproto/mtproto_config';
import replaceContent from '../../helpers/dom/replaceContent';
import FragmentedMpeg from '../../helpers/fragmentedMpeg';
import ButtonMenuToggle from '../buttonMenuToggle';
import {ButtonMenuItemOptionsVerifiable} from '../buttonMenu';
import PopupStreamOutputDevice from './streamOutputDevice';
import PopupStreamSettings from './streamSettings';
import Icons from '../../icons';
import PopupStreamRecord from './streamRecord';
import confirmationPopup from '../confirmationPopup';
import Row from '../row';
import {putPreloader} from '../putPreloader';
import {copyTextToClipboard} from '../../helpers/clipboard';
import Icon from '../icon';
import {replaceButtonIcon} from '../button';
import VolumeSelector from '../volumeSelector';
import PopupForward from './forward';
import appImManager from '../../lib/appManagers/appImManager';
import {toast} from '../toast';

const POPUP_STREAM_CLASSNAME = 'videostream';

const lastFrameByPeer = new Map();
// let activeVideoStreamPopup: PopupVideoStream = null;

try {
  if('onbeforeunload' in window) {
    window.addEventListener('beforeunload', async() => {
      console.log('triggered onbeforeunload');
      fetch('vstream/abort'); // Hack to stop infinite download
    });
  }
} catch(e) {}

export default class PopupVideoStream extends PopupElement {
  private groupCall: InputGroupCall.inputGroupCall;
  protected previewEl: HTMLElement;
  protected previewAvatarEl: HTMLElement;
  protected prevFrameCanvas: HTMLCanvasElement;
  protected videoEl: HTMLVideoElement;
  protected mediaSource: MediaSource;
  protected sourceBuffer: SourceBuffer;
  protected fragmentedMpeg = new FragmentedMpeg();
  protected pendingBuffers: ArrayBuffer[] = [];
  protected currentOutputId = '';
  protected peerId: PeerId | string;
  protected sourceId: number;
  protected serverUrl: string;
  protected streamKey: string;
  protected isAdmin: boolean;
  protected isStreamKeyMasked: boolean;
  protected isMuted: boolean;
  protected isPip: boolean;
  protected isEnding: boolean;

  protected pipExpandBtn: HTMLElement;
  protected pipCloseBtn: HTMLElement;

  protected oopsTimeout: any;
  protected reloadTimeout: any;
  protected refreshInterval: any;

  protected topBar: {
    el: HTMLElement,
    author: {
      el: HTMLElement,
      avatar: ReturnType<typeof avatarNew>,
      avatarMiddlewareHelper?: MiddlewareHelper,

      name: HTMLElement,
      status: HTMLElement
    },
    buttons: {
      el: HTMLElement,
      shareBtn: HTMLButtonElement,
      closeBtn: HTMLButtonElement
    }
  }

  protected bottomBar: {
    el: HTMLElement,
    liveIndicator: HTMLElement,
    volumeBtn: HTMLElement,
    // volumeSel: VolumeSelector,
    viewers: HTMLElement,
    buttons: {
      el: HTMLElement,
      menu: {
        toggleBtn?: HTMLElement,
        outputItem: ButtonMenuItemOptionsVerifiable,
        recordItem: ButtonMenuItemOptionsVerifiable,
        settingsItem: ButtonMenuItemOptionsVerifiable,
        endItem: ButtonMenuItemOptionsVerifiable
      },
      pipBtn: HTMLButtonElement,
      fullscreenBtn: HTMLButtonElement
    }
  }

  protected oopsBox: {
    el: HTMLElement,
    spinner: HTMLElement,
    title: HTMLElement,
    body: HTMLElement,
    serverUrlRow: Row,
    streamKeyRow: Row
  }

  constructor(options: {
    peerId: PeerId | string,
    sourceId: number,
    groupCall: InputGroupCall.inputGroupCall,
    serverUrl: string,
    streamKey: string,
    isAdmin: boolean
  }) {
    super('popup-stream', {
      body: true,
      withoutOverlay: false,
      closable: true,
      title: true
    });
    this.peerId = options.peerId;
    this.sourceId = options.sourceId;
    this.groupCall = options.groupCall;
    this.serverUrl = options.serverUrl;
    this.streamKey = options.streamKey;
    this.isAdmin = options.isAdmin;

    const createElement = (baseClass: string | null, ...classList: string[]): HTMLElement => {
      const el = document.createElement('div');
      baseClass && el.classList.add(POPUP_STREAM_CLASSNAME + '-' + baseClass, ...classList);
      return el;
    }

    this.topBar = {
      el: createElement('topbar'),
      author: {
        el: createElement('author', 'no-select'),
        name: createElement('author-name'),
        status: createElement('status')
      } as any,
      buttons: {
        el: createElement('topbar-buttons'),
        shareBtn: ButtonIcon('forward', {noRipple: true}),
        closeBtn: ButtonIcon('close', {noRipple: true})
      }
    }
    this.topBar.author.status.textContent = 'streaming'; // TODO: i18n
    this.topBar.author.el.append(this.topBar.author.name, this.topBar.author.status);
    this.topBar.buttons.el.append(this.topBar.buttons.shareBtn, this.topBar.buttons.closeBtn);
    this.topBar.el.append(this.topBar.author.el, this.topBar.buttons.el);

    this.bottomBar = {
      el: createElement('bottombar'),
      liveIndicator: createElement('live-indicator'),
      volumeBtn: ButtonIcon('volume_up', {noRipple: true}), // ['volume_off', 'volume_mute', 'volume_down', 'volume_up']
      // volumeSel: new VolumeSelector(this.listenerSetter),
      viewers: createElement('viewers'),
      buttons: {
        el: createElement('bottombar-buttons'),
        menu: {
          outputItem: {
            icon: 'volume_up',
            regularText: 'Output Device',
            onClick: this.onOutputClick
          },
          recordItem: {
            icon: 'radioon',
            regularText: 'Start Recording',
            onClick: this.onRecordClick
          },
          settingsItem: {
            icon: 'settings',
            regularText: 'Stream Settings',
            onClick: this.onSettingsClick
          },
          endItem: {
            icon: 'crossround',
            regularText: 'End Live Stream',
            className: 'danger',
            onClick: this.onEndClick
          }
        },
        pipBtn: ButtonIcon('pip', {noRipple: true}),
        fullscreenBtn: ButtonIcon('fullscreen', {noRipple: true})
      }
    }

    const buttons = [];
    if(!IS_SAFARI) { // Safari does not support setSinkId (changing output device)
      buttons.push(this.bottomBar.buttons.menu.outputItem);
    }
    if(this.isAdmin) {
      buttons.push(
        this.bottomBar.buttons.menu.recordItem,
        this.bottomBar.buttons.menu.settingsItem,
        this.bottomBar.buttons.menu.endItem
      );
    }
    if(buttons.length) {
      this.bottomBar.buttons.menu.toggleBtn = ButtonMenuToggle({direction: 'top-left', buttons});
      this.bottomBar.buttons.el.append(this.bottomBar.buttons.menu.toggleBtn);
    }

    this.bottomBar.liveIndicator.textContent = 'LIVE';
    this.bottomBar.viewers.textContent = '';
    this.bottomBar.buttons.el.append(
      this.bottomBar.buttons.pipBtn,
      this.bottomBar.buttons.fullscreenBtn
    );
    this.bottomBar.el.append(
      this.bottomBar.liveIndicator,
      this.bottomBar.volumeBtn,
      this.bottomBar.viewers,
      this.bottomBar.buttons.el
    );

    if(this.isAdmin) {
      this.oopsBox = {
        el: createElement('oops', 'hide'),
        spinner: createElement('oops-spinner'),
        title: createElement('oops-title'),
        body: createElement('oops-body'),
        serverUrlRow: new Row({
          icon: 'link',
          title: this.serverUrl || '-',
          subtitle: 'Server URL',
          buttonRight: ButtonIcon('copy', {noRipple: true}),
          clickable: () => copyTextToClipboard(this.serverUrl),
          listenerSetter: this.listenerSetter
        }),
        streamKeyRow: new Row({
          icon: 'lock',
          title: '••••••••••••••••••••',
          subtitle: 'Stream Key',
          buttonRight: ButtonIcon('copy', {noRipple: true}),
          clickable: () => copyTextToClipboard(this.streamKey),
          listenerSetter: this.listenerSetter
        })
      }
      putPreloader(this.oopsBox.spinner);
      this.oopsBox.title.textContent = 'Oops!';
      this.oopsBox.body.textContent = 'Telegram doesn\'t see any stream coming from your streaming app. Please make sure you entered the right Server URL and Stream Key in your app.';
      this.oopsBox.serverUrlRow.container.classList.add('stream-settings__server-url-row');
      this.oopsBox.streamKeyRow.container.classList.add('stream-settings__stream-key-row', 'is-masked');

      const showIcon = Icon('eye1');
      this.oopsBox.streamKeyRow.subtitle.append(showIcon);
      this.listenerSetter.add(showIcon)('click', () => {
        this.isStreamKeyMasked = !this.isStreamKeyMasked;
        this.oopsBox.streamKeyRow.container.classList.toggle('is-masked', this.isStreamKeyMasked);
        this.oopsBox.streamKeyRow.title.textContent = this.isStreamKeyMasked ? '••••••••••••••••••••' : this.streamKey;
      });

      this.oopsBox.el.append(
        this.oopsBox.spinner,
        this.oopsBox.title,
        this.oopsBox.body,
        this.oopsBox.serverUrlRow.container,
        this.oopsBox.streamKeyRow.container
      );

      this.container.append(this.oopsBox.el);
    }

    this.element.prepend(this.topBar.el);
    this.container.classList.add(POPUP_STREAM_CLASSNAME, 'night');
    this.container.append(this.bottomBar.el);

    this.pipExpandBtn = ButtonIcon('fullscreen', {noRipple: true});
    this.pipExpandBtn.classList.add('is-expand-btn', 'hide');
    this.pipCloseBtn = ButtonIcon('close', {noRipple: true});
    this.pipCloseBtn.classList.add('is-close-btn', 'hide');
    this.container.append(this.pipExpandBtn, this.pipCloseBtn);

    this.previewEl = createElement('preview');
    this.videoEl = document.createElement('video');
    this.videoEl.classList.add(POPUP_STREAM_CLASSNAME + '-video');
    this.videoEl.width = 1080;
    this.videoEl.height = 608;
    this.videoEl.defaultPlaybackRate = 0.9; // A hack to help with loading
    this.videoEl.playbackRate = 0.9;

    /* const tmpEl = document.createElement('div');
    for(const k in Icons) {
      tmpEl.append(ButtonIcon(k), k);
    } */
    this.body.append(this.previewEl);

    this.prevFrameCanvas = lastFrameByPeer.get(this.peerId);
    if(this.prevFrameCanvas) {
      this.body.append(this.prevFrameCanvas);
    }
    this.body.append(this.videoEl);

    /*
    const {listenerSetter} = this;
    listenerSetter.add(groupCallsController)('instance', (instance) => {
      this.updateInstance(instance);
    });

    const instance = this.instance = groupCallsController.groupCall;*/
    /*
    listenerSetter.add(instance)('state', () => {
      this.updateInstance();
    });
    listenerSetter.add(rootScope)('group_call_update', (groupCall) => {
      if(this.instance?.id === groupCall.id) {
        this.updateInstance();
      }
    }); */

    // listenerSetter.add(this.groupCallParticipantsVideo)('toggleControls', this.onToggleControls);

    this.listenerSetter.add(this.bottomBar.volumeBtn)('click', this.onMuteClick);
    this.listenerSetter.add(this.bottomBar.buttons.pipBtn)('click', this.onPipClick);
    this.listenerSetter.add(this.pipExpandBtn)('click', this.onPipClick);
    this.listenerSetter.add(this.pipCloseBtn)('click', () => this.hide());
    this.listenerSetter.add(this.bottomBar.buttons.fullscreenBtn)('click', this.onFullScreenClick);
    addFullScreenListener(this.container, this.onFullScreenChange, this.listenerSetter);

    this.listenerSetter.add(this.topBar.buttons.shareBtn)('click', this.onForwardClick);
    this.listenerSetter.add(this.topBar.buttons.closeBtn)('click', () => {
      this.hide();
    });

    this.addEventListener('close', async() => {
      // Destroy comps
      const lastFrameCanvas = document.createElement('canvas');
      lastFrameCanvas.classList.add(POPUP_STREAM_CLASSNAME + '-canvas');
      lastFrameCanvas.width = this.videoEl.width;
      lastFrameCanvas.height = this.videoEl.height;
      const ctx = lastFrameCanvas.getContext('2d');
      ctx.drawImage(this.videoEl, 0, 0, this.videoEl.width, this.videoEl.height);
      lastFrameByPeer.set(this.peerId, lastFrameCanvas);

      groupCallsController.currentVideoStreamId = null;
      clearTimeout(this.oopsTimeout);
      clearTimeout(this.reloadTimeout);
      clearInterval(this.refreshInterval);
      if(!this.isEnding) {
        this.managers.apiManager.invokeApi('phone.leaveGroupCall', {
          call: this.groupCall,
          source: this.sourceId
        }).then((updates) => {
          console.log('hangup', updates);
          this.managers.apiUpdatesManager.processUpdateMessage(updates);
        });
        appImManager.chat.topbar.chatStreamBar.toggle(false);
      }
      fetch('vstream/abort'); // Hack to stop infinite download

      appImManager.topbarPipStream.toggleState(false);
    });

    this.videoEl.addEventListener('play', () => { // 'loadeddata'? 'canplay'?
      this.previewEl.remove();
      if(this.prevFrameCanvas) {
        this.prevFrameCanvas.remove();
        lastFrameByPeer.delete(this.peerId);
      }
      this.bottomBar.liveIndicator.classList.add('is-active');
      clearTimeout(this.oopsTimeout);
      clearTimeout(this.reloadTimeout);
      this.oopsBox && this.oopsBox.el.classList.add('hide');
    });
    this.videoEl.addEventListener('canplay', () => {
      this.bottomBar.liveIndicator.classList.add('is-active');
      clearTimeout(this.oopsTimeout);
      clearTimeout(this.reloadTimeout);
      this.oopsBox && this.oopsBox.el.classList.add('hide');
      console.log('canplay');
      this.videoEl.play();
    });
    this.videoEl.addEventListener('waiting', () => { // 'waiting'? 'stalled'?
      this.bottomBar.liveIndicator.classList.remove('is-active');
      clearTimeout(this.oopsTimeout);
      clearTimeout(this.reloadTimeout);
      if(this.isAdmin) { // Wait some time for data
        this.oopsTimeout = setTimeout(this.onOops, 5000);
      } else {
        this.reloadTimeout = setTimeout(this.reloadVideo, 10000);
      }
    });
    rootScope.addEventListener('group_call_update', (groupCall) => {
      if(groupCall.id != this.groupCall.id) {
        return;
      }
      if(groupCall._ == 'groupCallDiscarded') {
        lastFrameByPeer.delete(this.peerId);
        this.isEnding = true;
        this.hide();
      } else {
        this.setParticipantsCount(groupCall);
      }
    });

    if(this.isAdmin) { // by default we are waiting
      this.oopsTimeout = setTimeout(this.onOops, 5000);
    } else {
      this.reloadTimeout = setTimeout(this.reloadVideo, 10000);
    }

    this.onFullScreenChange();

    this.setAuthorInfo(this.peerId);
    appImManager.topbarPipStream.setTitle(this.peerId as number);

    // return;

    // this.mediaSource = new MediaSource();
    // this.videoEl.src = URL.createObjectURL(this.mediaSource);
    // this.mediaSource.addEventListener('sourceopen', this.sourceOpen.bind(this));

    this.videoEl.autoplay = true;
    this.reloadVideo();
    this.refreshCount();

    this.refreshInterval = setInterval(this.refreshCount, 10000);

    groupCallsController.currentVideoStreamId = this.groupCall.id;

    if(this.isAdmin && !this.serverUrl) {
      this.managers.appPeersManager.getInputPeerById(this.peerId as number).then(async(peer) => {
        const settings: any = await this.managers.apiManager.invokeApi('phone.getGroupCallStreamRtmpUrl', {
          peer,
          revoke: false
        });
        this.serverUrl = settings.url;
        this.streamKey = settings.key;
        this.isStreamKeyMasked = true;
        this.oopsBox.serverUrlRow.title.textContent = this.serverUrl;
        this.oopsBox.streamKeyRow.title.textContent = '••••••••••••••••••••';
      });
    }
  }

  onOops = () => {
    clearTimeout(this.reloadTimeout);
    this.reloadTimeout = setTimeout(this.reloadVideo, 5000);
    this.oopsBox.el.classList.remove('hide');
  }

  reloadVideo = async() => {
    clearTimeout(this.reloadTimeout);
    this.reloadTimeout = setTimeout(this.reloadVideo, 10000); // wait another 10s

    /* This should be called, but I noticed that using timeMs = 0 (or -1000/-2000/...) works as well
    const channels = await this.managers.apiManager.invokeApi('phone.getGroupCallStreamChannels', {
      call: this.groupCall
    });

    const chosenChannel = channels.channels.filter(ch => ch.channel == 1 && ch.scale == 0)[0];
    */

    const dcId = await this.managers.apiManager.getBaseDcId();
    this.videoEl.src = 'vstream/' + encodeURIComponent(JSON.stringify({
      dcId,
      id: this.groupCall.id,
      accessHash: this.groupCall.access_hash,
      // timeMs: chosenChannel ? +chosenChannel.last_timestamp_ms - 4000 : 0,
      scale: 0,
      videoChannel: 1,
      videoQuality: 2,
      ts: Date.now()
    }));
  }

  refreshCount = async() => {
    const call = await this.managers.appGroupCallsManager.getGroupCallFull(this.groupCall.id);
    this.setParticipantsCount(call);
  }

  setParticipantsCount(call: GroupCall) {
    const count = Math.max(1, call._ == 'groupCall' ? call.participants_count : 0);
    this.bottomBar.viewers.textContent = count + ' watching';
    appImManager.topbarPipStream.setParticipantCount(count);
  }

  onForwardClick = () => {
    PopupElement.createPopup(PopupForward, null, async(peerId, threadId) => {
      const chat = await this.managers.appChatsManager.getChat(this.peerId.toChatId());
      await this.managers.appMessagesManager.sendText({
        peerId,
        threadId,
        text: `https://t.me/${(chat as Chat.channel).username}?livestream`
      });
      toast('Done!', () => {});
    });
  }

  onOutputClick = () => {
    const popup = PopupElement.createPopup(PopupStreamOutputDevice, {
      currentId: this.currentOutputId
    });
    popup.addEventListener('close', () => {
      this.currentOutputId = popup.currentId;
      (this.videoEl as any).setSinkId(popup.currentId);
    });
    popup.show();
  };

  onSettingsClick = () => {
    const popup = PopupElement.createPopup(PopupStreamSettings, {
      peerId: this.peerId as number,
      serverUrl: this.serverUrl,
      streamKey: this.streamKey,
      isRunning: true
    });
    popup.addEventListener('close', () => {
      if(popup.action == 'end') {
        this.endStream();
        return;
      }
      this.serverUrl = popup.serverUrl;
      this.streamKey = popup.streamKey;
      this.isStreamKeyMasked = true;
      this.oopsBox.serverUrlRow.title.textContent = this.serverUrl;
      this.oopsBox.streamKeyRow.title.textContent = '••••••••••••••••••••';
    });
    popup.show();
  };

  onRecordClick = () => {
    const popup = PopupElement.createPopup(PopupStreamRecord, {});
    popup.addEventListener('close', () => {
      if(popup.isConfirmed) {
        this.managers.apiManager.invokeApi('phone.toggleGroupCallRecord', {
          start: true,
          call: this.groupCall,
          title: popup.titleInput.value,
          video: popup.isVideoRecording,
          video_portrait: popup.isPortraitVideo
        }).then((updates) => {
          this.managers.apiUpdatesManager.processUpdateMessage(updates);
        });
      }
    });
    popup.show();
  };

  onEndClick = async() => {
    await confirmationPopup({
      title: 'End Video Stream',
      description: 'Are you sure you want to end stream?',
      button: {
        langKey: 'OK',
        isDanger: true
      }
    });
    this.endStream();
  };

  protected endStream() {
    lastFrameByPeer.delete(this.peerId);
    this.isEnding = true;
    this.managers.apiManager.invokeApi('phone.discardGroupCall', {
      call: this.groupCall
    }).then((updates) => {
      console.log('discard', updates);
      this.managers.apiUpdatesManager.processUpdateMessage(updates);
    });
    this.hide();
  }

  // From appMediaViewerBase
  protected setAuthorInfo(fromId: PeerId | string) {
    const isPeerId = fromId.isPeerId();
    let wrapTitlePromise: Promise<HTMLElement> | HTMLElement;
    if(isPeerId) {
      wrapTitlePromise = wrapPeerTitle({
        peerId: fromId as PeerId,
        dialog: false,
        onlyFirstName: false,
        plainText: false
      })
    } else {
      const title = wrapTitlePromise = document.createElement('span');
      title.append(wrapEmojiText(fromId));
      title.classList.add('peer-title');
    }

    const oldAvatar = this.topBar.author.avatar;
    const oldPreview = this.previewAvatarEl;
    const oldAvatarMiddlewareHelper = this.topBar.author.avatarMiddlewareHelper;
    const newAvatar = this.topBar.author.avatar = avatarNew({
      middleware: (this.topBar.author.avatarMiddlewareHelper = this.middlewareHelper.get().create()).get(),
      size: 44,
      peerId: fromId as PeerId || NULL_PEER_ID,
      peerTitle: isPeerId ? undefined : '' + fromId
    });

    newAvatar.node.classList.add(POPUP_STREAM_CLASSNAME + '-avatar');

    return Promise.all([
      newAvatar.readyThumbPromise,
      wrapTitlePromise
    ]).then(([_, title]) => {
      replaceContent(this.topBar.author.name, title);

      this.previewAvatarEl = this.topBar.author.avatar.node.cloneNode(true) as HTMLElement;
      this.previewAvatarEl.classList.remove('videostream-avatar');
      this.previewAvatarEl.classList.add('videostream-preview-avatar');

      if(oldAvatar?.node && oldAvatar.node.parentElement) {
        oldAvatar.node.replaceWith(this.topBar.author.avatar.node);
      } else {
        this.topBar.author.el.prepend(this.topBar.author.avatar.node);
      }

      if(oldPreview && oldPreview.parentElement) {
        oldPreview.replaceWith(this.previewAvatarEl);
      } else {
        this.previewEl.append(this.previewAvatarEl);
      }

      if(oldAvatar) {
        oldAvatar.node.remove();
        oldAvatarMiddlewareHelper.destroy();
      }
    });
  }

  private onFullScreenClick = () => {
    const isFull = isFullScreen();
    if(isFull) {
      document.exitFullscreen();
    } else {
      requestFullScreen(this.container);
    }
  };

  private onMuteClick = () => {
    this.isMuted = !this.isMuted;
    this.videoEl.muted = this.isMuted;
    replaceButtonIcon(this.bottomBar.volumeBtn, this.isMuted ? 'volume_off' : 'volume_up');
  };

  onPipClick = () => {
    this.isPip = !this.isPip;
    this.element.classList.toggle('is-pip', this.isPip);
    this.element.classList.toggle('whole', this.isPip);
    appImManager.topbarPipStream.toggleState(this.isPip); // Terrible way to update its state, but no time for clean solutions

    this.topBar.el.classList.toggle('hide', this.isPip);
    this.bottomBar.el.classList.toggle('hide', this.isPip);
    this.pipExpandBtn.classList.toggle('hide', !this.isPip);
    this.pipCloseBtn.classList.toggle('hide', !this.isPip);
  }

  public getContainer() {
    return this.container;
  }

  private onFullScreenChange = () => {
    const isFull = isFullScreen();

    // const fullscreenBtn = this.bottomBar.buttons.fullscreenBtn;

    const wasFullScreen = this.element.classList.contains('is-full-screen');
    this.element.classList.toggle('is-full-screen', isFull);
    // fullscreenBtn && fullscreenBtn.classList.toggle('hide', isFull);
    // btnExitFullScreen && btnExitFullScreen.classList.toggle('hide', !isFull);
    // this.btnClose.classList.toggle('hide', isFull);
    this.bottomBar.buttons.pipBtn.classList.toggle('hide', isFull);
    replaceButtonIcon(this.bottomBar.buttons.fullscreenBtn, isFull ? 'smallscreen' : 'fullscreen');

    if(isFull !== wasFullScreen) {
      animationIntersector.checkAnimations2(isFull);

      themeController.setThemeColor(isFull ? '#000000' : undefined);
    }
  }

  /*
  async sourceOpen() {
    this.sourceBuffer = this.mediaSource.addSourceBuffer('video/mp4; codecs="avc1.64001f,opus"; profiles="isom,iso2,avc1,mp41"');
    this.sourceBuffer.addEventListener('updateend', this.sourceUpdated.bind(this));
    this.sourceBuffer.addEventListener('error', function(e) { console.log('error: ' + e); });
    this.sourceBuffer.mode = 'sequence';

    this.appendNextChunk();
  }

  async sourceUpdated() {
    if(this.pendingBuffers.length) {
      this.sourceBuffer.appendBuffer(this.pendingBuffers.shift());
    }
  }

  appendBuffers(buffers: ArrayBuffer[]) {
    if(this.pendingBuffers.length) {
      this.pendingBuffers = this.pendingBuffers.concat(buffers);
      return;
    }
    this.pendingBuffers = buffers;
    if(!this.sourceBuffer.updating) {
      this.sourceBuffer.appendBuffer(this.pendingBuffers.shift());
    }
  }
  */
  /*
  private async appendNextChunk() {
    this.loadTimer = setTimeout(() => {
      this.appendNextChunk();
    }, 1000);

    const scale = 0; // 1sec
    const timeMs = -(scale >= 0 ? 1000 >> scale : (1000 << -scale)); // Math.floor(Date.now() / 1000) * 1000 - 1000;
    const chunk = await this.managers.apiManager.invokeApi('upload.getFile', {
      location: {
        _: 'inputGroupCallStream',
        call: this.groupCall,
        time_ms: timeMs,
        scale,
        video_channel: 1,
        video_quality: 2
      },
      precise: false,
      offset: 0,
      limit: 524288
    });

    const rawMp4 = (chunk as any).bytes.buffer.slice(32);
    const fragMp4 = this.fragmentedMpeg.appendChunk(rawMp4);
    console.log('got ', rawMp4.byteLength, ' bytes, converted to ', fragMp4);

    // push to video
    this.appendBuffers(fragMp4);
  }
  */
}
