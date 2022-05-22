import React from "react";
import { isThisTypeNode, textChangeRangeIsUnchanged } from "typescript";
import { CryptoMembership, Fingerprint, Name } from "../model/Crypto";
import { PublicState } from "../model/AssemblyState";
import { MemberList } from "./MemberList";
import ReadinessPanel from "./ReadinessPanel";

export type Props = {
  waiting: PublicState.Status.Waiting;
  names: (member: Fingerprint) => Name;
};
export type State = {};

export default class WaitingPanel extends React.Component<Props, State> {
  render(): JSX.Element {
    let harvestPanel: JSX.Element;
    if (this.props.waiting.question) {
      harvestPanel = <AnswerPanel question={this.props.waiting.question} />;
    } else {
      harvestPanel = <QuestionPanel />;
    }

    return (
      <div>
        {harvestPanel}
        <ReadinessPanel readiness={[]} names={(x) => "???"} />
      </div>
    );
  }
}

type Phase<A> = Phase.Reply | Phase.Confirm<A> | Phase.Confirmed;

namespace Phase {
  export type Reply = {
    tag: "reply";
  };

  export const reply: Reply = { tag: "reply" };

  export type Confirm<A> = {
    tag: "confirm";
    answer: A;
  };

  export function confirm<A>(answer: A): Confirm<A> {
    return {
      tag: "confirm",
      answer: answer,
    };
  }

  export type Confirmed = {
    tag: "confirmed";
  };

  export const confirmed: Confirmed = {
    tag: "confirmed",
  };
}

//////////////////////////////////////////
// Harvest Type = Answer

type AnswerProps = {
  question: string;
};
type AnswerState = {
  phase: Phase<boolean>;
};

class AnswerPanel extends React.Component<AnswerProps, AnswerState> {
  constructor(props: AnswerProps) {
    super(props);
    this.state = { phase: Phase.reply };
    this.changeState = this.changeState.bind(this);
  }

  changeState(phase: Phase<boolean>) {
    this.setState({ phase: phase });
  }

  render(): JSX.Element {
    let phasePanel: JSX.Element;

    switch (this.state.phase.tag) {
      case "reply":
        phasePanel = <AnswerPanel.Reply changeState={this.changeState} />;
        break;
      case "confirm":
        phasePanel = (
          <AnswerPanel.Confirm
            changeState={this.changeState}
            answer={this.state.phase.answer}
          />
        );
        break;
      case "confirmed":
        phasePanel = <AnswerPanel.Confirmed />;
        break;
    }

    return (
      <div>
        <h2>Il est temps de répondre!</h2>
        <p>
          La question est:{" "}
          <span className="question">{this.props.question}</span>
        </p>
        {phasePanel}
      </div>
    );
  }
}

namespace AnswerPanel {
  type ReplyProps = {
    changeState: (phase: Phase<boolean>) => void;
  };

  export class Reply extends React.Component<ReplyProps, {}> {
    render(): JSX.Element {
      return (
        <div>
          <button
            type="button"
            onClick={() => this.props.changeState(Phase.confirm(true))}
          >
            Je réponds OUI!
          </button>
          <button
            type="button"
            onClick={() => this.props.changeState(Phase.confirm(false))}
          >
            Je réponds NON!
          </button>
        </div>
      );
    }
  }

  type ConfirmProps = {
    changeState: (phase: Phase<boolean>) => void;
    answer: boolean;
  };

  export class Confirm extends React.Component<ConfirmProps, {}> {
    render(): JSX.Element {
      return (
        <div>
          <p>
            Vous avez choisi de répondre :{" "}
            <span className="answer">{this.props.answer ? "OUI" : "NON"}.</span>
          </p>
          <button
            type="button"
            onClick={() => this.props.changeState(Phase.confirmed)}
          >
            Je confirme ma réponse!
          </button>
          <button
            type="button"
            onClick={() => this.props.changeState(Phase.reply)}
          >
            Revenir en arrière!
          </button>
        </div>
      );
    }
  }

  export class Confirmed extends React.Component<{}, {}> {
    render(): JSX.Element {
      return <p>Votre réponse est enregistrée!</p>;
    }
  }
}

//////////////////////////////////////////
// Harvest Type = Question

type QuestionProps = {};
type QuestionState = {
  phase: Phase<string | undefined>;
};

class QuestionPanel extends React.Component<QuestionProps, QuestionState> {
  constructor(props: AnswerProps) {
    super(props);
    this.state = { phase: Phase.reply };
    this.changePhase = this.changePhase.bind(this);
  }

  changePhase(phase: Phase<string | undefined>) {
    this.setState({ phase: phase });
  }

  render(): JSX.Element {
    let phasePanel: JSX.Element;

    switch (this.state.phase.tag) {
      case "reply":
        phasePanel = <QuestionPanel.Reply changeState={this.changePhase} />;
        break;
      case "confirm":
        phasePanel = (
          <QuestionPanel.Confirm
            changePhase={this.changePhase}
            question={this.state.phase.answer}
          />
        );
        break;
      case "confirmed":
        phasePanel = <QuestionPanel.Confirmed />;
        break;
    }

    return (
      <div>
        <h2>Vous pouvez soumettre une question au groupe</h2>
        {phasePanel}
      </div>
    );
  }
}

namespace QuestionPanel {
  type ReplyProps = {
    changeState: (phase: Phase<string | undefined>) => void;
  };

  type ReplyState = {
    input: string;
  };

  export class Reply extends React.Component<ReplyProps, ReplyState> {
    constructor(props: ReplyProps) {
      super(props);
      this.state = { input: "" };
      this.ask = this.ask.bind(this);
      this.dontAsk = this.dontAsk.bind(this);
    }

    ask() {
      this.props.changeState(
        Phase.confirm(this.state.input ? this.state.input : undefined)
      );
    }

    dontAsk() {
      this.props.changeState(Phase.confirm(undefined));
    }

    render(): JSX.Element {
      return (
        <div>
          <ul>
            <li>
              <label>Votre question : </label>
              <input
                type="text"
                value={this.state.input}
                onChange={(ev) => this.setState({ input: ev.target.value })}
              />
              <button type="button" onClick={this.ask}>
                Valider ma question.
              </button>
            </li>
            <li>
              <button type="button" onClick={this.dontAsk}>
                Je ne pose aucune question!
              </button>
            </li>
          </ul>
        </div>
      );
    }
  }

  type ConfirmProps = {
    changePhase: (phase: Phase<string | undefined>) => void;
    question: string | undefined;
  };

  export class Confirm extends React.Component<ConfirmProps, {}> {
    render(): JSX.Element {
      return (
        <div>
          {this.props.question ? (
            <p>
              Vous avez choisi de poser comme question : "
              <span className="question">{this.props.question}</span>"
            </p>
          ) : (
            <p>Vous avez choisi de ne pas poser de question.</p>
          )}
          <button
            type="button"
            onClick={() => this.props.changePhase(Phase.confirmed)}
          >
            Je confirme mon choix!
          </button>
          <button
            type="button"
            onClick={() => this.props.changePhase(Phase.reply)}
          >
            Revenir en arrière!
          </button>
        </div>
      );
    }
  }

  export class Confirmed extends React.Component<{}, {}> {
    render(): JSX.Element {
      return <p>Votre choix est enregistrée!</p>;
    }
  }
}
