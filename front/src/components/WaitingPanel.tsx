import { useState } from "react";
import { Fingerprint, Name } from "../model/Crypto";
import { AssemblyState } from "../model/AssemblyState";
import ReadinessPanel from "./ReadinessPanel";

type Props = {
  waiting: AssemblyState.Status.Waiting;
  sendAnswer(answer: boolean): void;
  sendQuestion(question: string | null): void;
  name(member: Fingerprint): Promise<Name>;
};

export default function WaitingPanel(props: Props): JSX.Element {
  let waitingPanel: JSX.Element;
  if (props.waiting.question) {
    waitingPanel = (
      <AnswerPanel
        question={props.waiting.question}
        sendAnswer={props.sendAnswer}
      />
    );
  } else {
    waitingPanel = <QuestionPanel sendQuestion={props.sendQuestion} />;
  }

  return (
    <div>
      {waitingPanel}
      <ReadinessPanel readiness={props.waiting.ready} name={props.name} />
    </div>
  );
}

type Phase<A> =
  | Phase.Reply
  | Phase.Confirm<A>
  | Phase.Blocking
  | Phase.Confirmed;

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

  export type Blocking = {
    tag: "blocking";
  };

  export const blocking: Blocking = {
    tag: "blocking",
  };

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
  sendAnswer(answer: boolean): void;
};

function AnswerPanel(props: AnswerProps): JSX.Element {
  const [phase, setPhase] = useState<Phase<boolean>>(Phase.reply);

  let phasePanel: JSX.Element;

  function changePhase(newPhase: Phase<boolean>) {
    if (phase.tag === "reply" && newPhase.tag === "confirm") setPhase(newPhase);
    else {
      if (phase.tag === "confirm" && newPhase.tag === "confirmed") {
        props.sendAnswer(phase.answer);
        setPhase(newPhase);
      } else
        throw Error(
          `Wrong phase answer transition ${phase.tag} to ${newPhase.tag}!`
        );
    }
  }

  switch (phase.tag) {
    case "reply":
      phasePanel = <AnswerPanelNS.Reply changeState={changePhase} />;
      break;
    case "confirm":
      phasePanel = (
        <AnswerPanelNS.Confirm
          changeState={changePhase}
          answer={phase.answer}
        />
      );
      break;
    case "blocking":
      phasePanel = <AnswerPanelNS.Blocking changeState={changePhase} />;
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

  export function Blocking(props: {
    changeState: (phase: Phase<boolean>) => void;
  }): JSX.Element {
    return (
      <div>
        <p>Vous bloquez le vote.</p>
        <button
          type="button"
          onClick={() => props.changeState(Phase.confirmed)}
        >
          Debloquer le vote
        </button>
      </div>
    );
  }

  export function Confirmed(): JSX.Element {
    return <p>Vous être prêt.e à soumettre vôtre choix.</p>;
  }
}

//////////////////////////////////////////
// Harvest Type = Question

function QuestionPanel(props: {
  sendQuestion(question: string | null): void;
}): JSX.Element {
  const [phase, setPhase] = useState<Phase<string | null>>(Phase.reply);

  function changePhase(newPhase: Phase<string | null>) {
    if (phase.tag === "reply" && newPhase.tag === "confirm") setPhase(newPhase);
    else {
      if (phase.tag === "confirm" && newPhase.tag === "confirmed") {
        props.sendQuestion(phase.answer);
        setPhase(newPhase);
      } else
        throw Error(
          `Wrong phase answer transition ${phase.tag} to ${newPhase.tag}!`
        );
    }
  }

  let phasePanel: JSX.Element;

  switch (phase.tag) {
    case "reply":
      phasePanel = <QuestionPanelNS.Reply changeState={changePhase} />;
      break;
    case "confirm":
      phasePanel = (
        <QuestionPanelNS.Confirm
          changePhase={changePhase}
          question={phase.answer}
        />
      );
      break;
    case "blocking":
      phasePanel = <QuestionPanelNS.Blocking changePhase={changePhase} />;
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
    changeState: (phase: Phase<string | null>) => void;
  };

  export function Reply(props: ReplyProps): JSX.Element {
    const [input, setInput] = useState<string>("");

    function ask() {
      props.changeState(Phase.confirm(input ? input : null));
    }

    function dontAsk() {
      props.changeState(Phase.confirm(null));
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
    changePhase: (phase: Phase<string | null>) => void;
    question: string | null;
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

  export function Blocking(props: {
    changePhase: (phase: Phase<string | null>) => void;
  }): JSX.Element {
    return (
      <div>
        <p>Vous bloquez le vote.</p>
        <button
          type="button"
          onClick={() => props.changePhase(Phase.confirmed)}
        >
          Debloquer le vote
        </button>
      </div>
    );
  }

  export function Confirmed(): JSX.Element {
    return <p>Votre choix est enregistrée!</p>;
  }
}
