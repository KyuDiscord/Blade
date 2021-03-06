import { Params } from "./Params";
import { Flags } from "./Flags";

import type { Embed, Guild, Member, Message, TextBasedChannel, User } from "@kyudiscord/neo";
import type { CommandDispatcher } from "../CommandDispatcher";
import type { BladeClient } from "../../../Client";
import type { ParamType } from "../parameter/TypeResolver";
import type { LanguageHandler } from "../../language/LanguageHandler";
import type { TemplateTag } from "../../../util";
import type { Language } from "../../language/Language";

export class Context {
  /**
   * The message.
   */
  public readonly message: Message;

  /**
   * The client.
   */
  public readonly client: BladeClient;

  /**
   * The command dispatcher.
   */
  public readonly dispatcher: CommandDispatcher;

  /**
   * Parsed Parameters for this invocation
   */
  public params: Params;

  /**
   * Parsed flags for this invocation.
   */
  public flags: Flags;

  /**
   * The author of this message.
   */
  public author: User;

  /**
   * The invoker.
   */
  public member: Member | null;

  /**
   * The guild this message was sent in.
   */
  public guild: Guild | null;

  /**
   * The channel this message sent in.
   */
  public channel: TextBasedChannel;

  /**
   * Whether or not the last response should be edited.
   */
  public shouldEdit: boolean;

  /**
   * The last response.
   */
  public lastResponse?: Message;

  /**
   * All responses..
   */
  public messages: Map<string, Message>;

  /**
   * Parsing index.
   */
  public parseIndex: number;

  /**
   * @param dispatcher
   * @param message
   */
  public constructor(dispatcher: CommandDispatcher, message: Message) {
    this.message = message;
    this.client = dispatcher.client;
    this.dispatcher = dispatcher;

    this.params = new Params();
    this.flags = new Flags();

    this.author = message.author;
    this.member = message.member;
    this.guild = message.guild;
    this.channel = message.channel;

    this.shouldEdit = false;
    this.messages = new Map();
    this.parseIndex = 0;

    this.reply = this.reply.bind(this);
    this.edit = this.edit.bind(this);
  }

  /**
   * The language for this context.
   */
  public async language(): Promise<Language | undefined> {
    const languages = this.client.handlers.get("languages") as LanguageHandler;
    if (!languages) return undefined;
    return languages.get(await this.dispatcher.options.getLanguage!.call(languages, this));
  }

  /**
   * Replies to the message.
   * @param content
   */
  public async reply(content: string | Embed): Promise<Message> {
    if (this.shouldEdit && !this.lastResponse?.attachments.size) {
      return this.edit(content);
    }

    const messages = await (typeof content === "string"
      ? this.channel.send(content)
      : this.channel.send(b => b.setEmbed(content)));

    const lastSent = this.setLastResponse(messages);
    this.setEditable(!lastSent.attachments.size);

    return messages[messages.length - 1];
  }

  /**
   * Edits the last response.
   * @param content Content to edit the message with.
   */
  public async edit(content: string | Embed): Promise<Message> {
    return typeof content === "string"
      ? this.lastResponse!.edit(content)
      : this.lastResponse!.edit(b => b.setEmbed(content));
  }

  /**
   * Resolve a string into a specific type.
   * @param value The value to resolve
   * @param type The type.
   * @since 1.0.3
   */
  public async resolve<T = unknown>(value: string, type: ParamType): Promise<T | null> {
    const resolver = this.dispatcher.resolver.type(type);
    if (!resolver) throw new Error(`Type "${type}" does not exist.`);
    return (await resolver(value, this) as T) ?? null;
  }

  /**
   * Get a translation.
   * @param path The translation path.
   * @param context The context to use.
   */
  public async translate<T = string>(path: string, context: Dictionary = {}): Promise<T> {
    const language = await this.language();
    if (language) return language.translate(path, context);
    throw new Error("No Language Handler Available");
  }

  /**
   * Translate the template literal.
   */
  public t<T = string>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>
  /**
   * Get a translation
   * @param context The context to use.
   */
  public t<T = string>(context: Dictionary): TemplateTag<Promise<T>>
  public t<T>(a1: Dictionary | TemplateStringsArray, ...a2: unknown[]): Promise<T> | TemplateTag<Promise<T>> {
    const translate = (context: Dictionary = {}) => {
      return (strings: any[], ...values: unknown[]) => {
        const joined = strings.map((s, i) => s + (values[i] ?? "")).join("");
        return this.translate(joined, context);
      };
    };

    return (Array.isArray(a1) ? translate()(a1, a2) : translate(a1)) as any;
  }


  /**
   * Sets the last response of this context.
   * @param message The last message.
   */
  private setLastResponse(message: Message | Message[]): Message {
    if (Array.isArray(message)) this.lastResponse = message.slice(-1)[0];
    else this.lastResponse = message;
    return this.lastResponse;
  }

  /**
   * Changes the should edit state of this context.
   * @param state Whether or not the message should be editable.
   */
  private setEditable(state: boolean): this {
    this.shouldEdit = state;
    return this;
  }
}
