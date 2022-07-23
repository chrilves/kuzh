import { useState } from "react";
import { Fingerprint, Name } from "../model/Crypto";
import { PublicState } from "../model/AssemblyState";
import ReadinessPanel from "./ReadinessPanel";

type Props = {
  waiting: PublicState.Status.Waiting;
  names: (member: Fingerprint) => Name;
};

export default function WaitingPanel(props: Props): JSX.Element {
  let harvestPanel: JSX.Element;
  if (props.waiting.question) {
    harvestPanel = <AnswerPanel question={props.waiting.question} />;
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

function AnswerPanel(props: AnswerProps): JSX.Element {
  const [phase, setPhase] = useState<Phase<boolean>>(Phase.reply);

  let phasePanel: JSX.Element;

  switch (phase.tag) {
    case "reply":
      phasePanel = <AnswerPanelNS.Reply changeState={setPhase} />;
      break;
    case "confirm":
      phasePanel = (
        <AnswerPanelNS.Confirm changeState={setPhase} answer={phase.answer} />
      );
      break;
    case "confirmed":
      phasePanel = <AnswerPanelNS.Confirmed />;
      break;
  }

  return (
    <div>
      <h2>Il est temps de répondre!</h2>
      <p>
        La question est: <span className="question">{props.question}</span>
      </p>
      {phasePanel}
    </div>
  );
}

namespace AnswerPanelNS {
  type ReplyProps = {
    changeState: (phase: Phase<boolean>) => void;
  };

  export function Reply(props: ReplyProps): JSX.Element {
    return (
      <div>
        <button
          type="button"
          onClick={() => props.changeState(Phase.confirm(true))}
        >
          Je réponds OUI!
        </button>
        <button
          type="button"
          onClick={() => props.changeState(Phase.confirm(false))}
        >
          Je réponds NON!
        </button>
      </div>
    );
  }

  type ConfirmProps = {
    changeState: (phase: Phase<boolean>) => void;
    answer: boolean;
  };

  export function Confirm(props: ConfirmProps): JSX.Element {
    return (
      <div>
        <p>
          Vous avez choisi de répondre :{" "}
          <span className="answer">{props.answer ? "OUI" : "NON"}.</span>
        </p>
        <button
          type="button"
          onClick={() => props.changeState(Phase.confirmed)}
        >
          Je confirme ma réponse!
        </button>
        <button type="button" onClick={() => props.changeState(Phase.reply)}>
          Revenir en arrière!
        </button>
      </div>
    );
  }

  export function Confirmed(): JSX.Element {
    return <p>Votre réponse est enregistrée!</p>;
  }
}

//////////////////////////////////////////
// Harvest Type = Question

function QuestionPanel(): JSX.Element {
  const [phase, setPhase] = useState<Phase<string | undefined>>(Phase.reply);

  let phasePanel: JSX.Element;

  switch (phase.tag) {
    case "reply":
      phasePanel = <QuestionPanelNS.Reply changeState={setPhase} />;
      break;
    case "confirm":
      phasePanel = (
        <QuestionPanelNS.Confirm
          changePhase={setPhase}
          question={phase.answer}
        />
      );
      break;
    case "confirmed":
      phasePanel = <QuestionPanelNS.Confirmed />;
      break;
  }

  return (
    <div>
      <h2>Vous pouvez soumettre une question au groupe</h2>
      {phasePanel}
    </div>
  );
}

namespace QuestionPanelNS {
  type ReplyProps = {
    changeState: (phase: Phase<string | undefined>) => void;
  };

  export function Reply(props: ReplyProps): JSX.Element {
    const [input, setInput] = useState<string>("");

    function ask() {
      props.changeState(Phase.confirm(input ? input : undefined));
    }

    function dontAsk() {
      props.changeState(Phase.confirm(undefined));
    }

    return (
      <div>
        <ul>
          <li>
            <label>Votre question : </label>
            <input
              type="text"
              value={input}
              onChange={(ev) => setInput(ev.target.value)}
            />
            <button type="button" onClick={ask}>
              Valider ma question.
            </button>
          </li>
          <li>
            <button type="button" onClick={dontAsk}>
              Je ne pose aucune question!
            </button>
          </li>
        </ul>
      </div>
    );
  }

  type ConfirmProps = {
    changePhase: (phase: Phase<string | undefined>) => void;
    question: string | undefined;
  };

  export function Confirm(props: ConfirmProps): JSX.Element {
    return (
      <div>
        {props.question ? (
          <p>
            Vous avez choisi de poser comme question : "
            <span className="question">{props.question}</span>"
          </p>
        ) : (
          <p>Vous avez choisi de ne pas poser de question.</p>
        )}
        <button
          type="button"
          onClick={() => props.changePhase(Phase.confirmed)}
        >
          Je confirme mon choix!
        </button>
        <button type="button" onClick={() => props.changePhase(Phase.reply)}>
          Revenir en arrière!
        </button>
      </div>
    );
  }

  export function Confirmed(): JSX.Element {
    return <p>Votre choix est enregistrée!</p>;
  }
}
