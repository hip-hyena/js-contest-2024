import {attachClickEvent} from '../helpers/dom/clickEvent';
import ListenerSetter from '../helpers/listenerSetter';
import rootScope from '../lib/rootScope';
import SetTransition from './singleTransition';
import GroupCallDescriptionElement from './groupCall/description';
import GroupCallTitleElement from './groupCall/title';
import PopupElement from './popups';
import GroupCallInstance from '../lib/calls/groupCallInstance';
import replaceContent from '../helpers/dom/replaceContent';
import PeerTitle from './peerTitle';
import CallDescriptionElement from './call/description';
import {AppManagers} from '../lib/appManagers/managers';
import groupCallsController from '../lib/calls/groupCallsController';
import callsController from '../lib/calls/callsController';
import PopupStream from './popups/stream';
import Chat from './chat/chat';

const CLASS_NAME = 'topbar-stream';

export default class TopbarPipStream {
  public container: HTMLElement;
  private titleEl: HTMLElement;
  private statusEl: HTMLElement;
  private listenerSetter: ListenerSetter;
  private center: HTMLDivElement;
  private groupCallTitle: GroupCallTitleElement;
  private groupCallDescription: GroupCallDescriptionElement;
  private callDescription: CallDescriptionElement;

  private currentDescription: GroupCallDescriptionElement | CallDescriptionElement;

  private instanceListenerSetter: ListenerSetter;

  private chat: Chat;

  private isVisible: boolean = false;

  public updateChat(chat: Chat) {
    this.chat = chat;
  }

  public toggleState(isVisible: boolean) {
    console.log('pip stream bar: ', isVisible);
    this.isVisible = isVisible;
    this.updateInstance();
  }

  private updateInstance() {
    if(this.construct) {
      this.construct();
      this.construct = undefined;
    }

    const isClosed = !this.isVisible;
    if(!document.body.classList.contains('is-watching-stream') || isClosed) {
      SetTransition({
        element: document.body,
        className: 'is-watching-stream',
        forwards: !isClosed,
        duration: 250
      });
    }

    if(isClosed) {
      return;
    }
  }

  public setParticipantCount(count: number) {
    this.updateInstance();
    this.statusEl.textContent = count ? count + ' watching' : '';
  }

  public setTitle(peerId: number) {
    this.updateInstance();
    replaceContent(this.titleEl, new PeerTitle({peerId}).element);
  }

  private construct() {
    const {listenerSetter} = this;
    const container = this.container = document.createElement('div');
    container.classList.add('sidebar-header', CLASS_NAME + '-container');

    const left = document.createElement('div');
    left.classList.add(CLASS_NAME + '-left');
    left.textContent = 'LIVE';

    const center = this.center = document.createElement('div');
    center.classList.add(CLASS_NAME + '-center');

    this.titleEl = document.createElement('span');
    this.statusEl = document.createElement('div');
    this.statusEl.classList.add('topbar-stream-status');
    center.append(this.titleEl, this.statusEl);

    attachClickEvent(container, async() => {
      if(!PopupElement.getPopups(PopupStream).length) {
        return;
      }
      PopupElement.getPopups(PopupStream)[0].onPipClick();
    }, {listenerSetter});

    container.append(left, center);
    document.getElementById('column-center').prepend(container);
  }
}
