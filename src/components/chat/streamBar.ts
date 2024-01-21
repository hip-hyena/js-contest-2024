import type ChatTopbar from './topbar';
import DivAndCaption from '../divAndCaption';
import PinnedContainer from './pinnedContainer';
import Chat from './chat';
import cancelEvent from '../../helpers/dom/cancelEvent';
import {attachClickEvent} from '../../helpers/dom/clickEvent';
import {LangPackKey, i18n} from '../../lib/langPack';
import {AppManagers} from '../../lib/appManagers/managers';
import ReplyContainer from './replyContainer';
import PopupElement from '../popups';
import PopupVideoStream from '../popups/stream';
import rootScope from '../../lib/rootScope';

export default class ChatStreamBar extends PinnedContainer {
  public streamInfo: ReplyContainer;
  public joinBtn: HTMLElement;
  constructor(protected topbar: ChatTopbar, protected chat: Chat, protected managers: AppManagers) {
    super({
      topbar,
      chat,
      listenerSetter: topbar.listenerSetter,
      className: 'stream-bar',
      divAndCaption: new DivAndCaption(
        'pinned-stream',
        (options) => {
          // replaceContent(this.divAndCaption.title, options.title);
          // replaceContent(this.divAndCaption.subtitle, options.subtitle);
        }
      ),
      floating: true
    });

    // this.middlewareHelper = getMiddleware();

    // this.wrapper.firstElementChild.remove();

    this.divAndCaption.border.remove();
    // this.divAndCaption.content.remove();
    this.btnClose.remove();

    this.streamInfo = new ReplyContainer('stream-bar-info');
    this.streamInfo.container.classList.add('quote-like', 'quote-like-border');
    this.streamInfo.title.append(i18n('PeerInfo.Action.LiveStream'));
    this.streamInfo.subtitle.append('Nobody watching');
    this.divAndCaption.content.replaceWith(this.streamInfo.container);

    this.joinBtn = document.createElement('div');
    this.joinBtn.className = 'stream-bar-join-btn';
    this.joinBtn.append(i18n('ChannelJoin'));
    this.streamInfo.container.append(this.joinBtn);

    attachClickEvent(this.wrapper, async(e) => {
      cancelEvent(e);
      const chatId = this.chat.peerId.toChatId();
      const chatFull = await this.managers.appProfileManager.getChannelFull(chatId);
      const isAdmin = await this.managers.appChatsManager.hasRights(chatId, 'create_videostream');
      this.chat.appImManager.joinVideoStream(this.chat.peerId, chatFull.call, isAdmin);
    }, {listenerSetter: topbar.listenerSetter});

    topbar.listenerSetter.add(rootScope)('group_call_update', (groupCall: any) => {
      this.setParticipantCount(groupCall.participant_count);
    });
  }

  public setParticipantCount(count: number) {
    this.streamInfo.subtitle.textContent = count ? count + ' watching' : 'Nobody watching';
  }

  public triggerJoinAnim() {
    this.joinBtn.classList.add('anim');
    setTimeout(() => this.joinBtn.classList.remove('anim'), 0);
  }

  public destroy() {
  }
}
