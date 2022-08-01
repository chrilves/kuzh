import { useState } from "react";
import { Fingerprint, Name } from "../model/Crypto";
import { AssemblyState } from "../model/AssemblyState";
import ReadinessPanel from "./ReadinessPanel";
import { Member } from "../model/Member";

type Props = {
  myFingerprint: Fingerprint;
  waiting: AssemblyState.Status.Waiting;
  sendAnswer(answer: boolean): void;
  sendQuestion(question: string | null): void;
  changeReadiness(r: Member.Blockingness): void;
  name(member: Fingerprint): Promise<Name>;
};

export default function WaitingPanel(props: Props): JSX.Element {
  let waitingPanel: JSX.Element;

  const myMemberReadiness = props.waiting.ready.find(
    (x) => x.member === props.myFingerprint
  );

  if (props.waiting.question) {
    waitingPanel = (
      <AnswerPanel
        question={props.waiting.question}
        sendAnswer={props.sendAnswer}
        myReadiness={myMemberReadiness?.readiness}
        changeReadiness={props.changeReadiness}
      />
    );
  } else {
    waitingPanel = (
      <QuestionPanel
        sendQuestion={props.sendQuestion}
        myReadiness={myMemberReadiness?.readiness}
        changeReadiness={props.changeReadiness}
      />
    );
  }

  return (
    <div>
      {waitingPanel}
      <ReadinessPanel readiness={props.waiting.ready} name={props.name} />
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

  export function change<A>(
    oldPhase: Phase<A>,
    newPhase: Phase<A>,
    f: (a: A) => void
  ): boolean {
    if (
      (oldPhase.tag === "reply" && newPhase.tag === "confirm") ||
      (oldPhase.tag === "confirm" && newPhase.tag === "reply")
    )
      return true;
    else {
      if (oldPhase.tag === "confirm" && newPhase.tag === "confirmed") {
        f(oldPhase.answer);
        return true;
      } else return false;
    }
  }

  export function initial<A>(ready: Member.Readiness | undefined): Phase<A> {
    switch (ready) {
      case "blocking":
        return Phase.confirmed;
      case "ready":
        return Phase.confirmed;
      default:
        return Phase.reply;
    }
  }
}

function Confirmed(props: {
  changeReadiness(r: Member.Blockingness): void;
  myBlockingness: Member.Blockingness;
}): JSX.Element {
  const [desired, setDesired] = useState<Member.Blockingness>(
    props.myBlockingness
  );

  function renderOk(
    msg: string,
    buttonMsg: string,
    other: Member.Blockingness
  ) {
    function flip() {
      setDesired(other);
      props.changeReadiness(other);
    }

    return (
      <div>
        <p>{msg}</p>
        {desired === props.myBlockingness && (
          <div>
            <button type="button" onClick={flip}>
              {buttonMsg}
            </button>
          </div>
        )}
      </div>
    );
  }

  switch (props.myBlockingness) {
    case "blocking":
      return renderOk("Vous bloquez le vote.", "Debloquer le vote", "ready");
    case "ready":
      return renderOk(
        "Votre choix est enregistré!",
        "Bloquer le vote",
        "blocking"
      );
  }
}

//////////////////////////////////////////
// Harvest Type = Answer

type AnswerProps = {
  question: string;
  sendAnswer(answer: boolean): void;
  myReadiness: Member.Readiness | undefined;
  changeReadiness(r: Member.Blockingness): void;
};

function AnswerPanel(props: AnswerProps): JSX.Element {
  const [phase, setPhase] = useState<Phase<boolean>>(
    Phase.initial(props.myReadiness)
  );

  function changePhase(newPhase: Phase<boolean>) {
    if (Phase.change(phase, newPhase, props.sendAnswer)) setPhase(newPhase);
    else
      throw Error(
        `Wrong phase answer transition ${phase.tag} to ${newPhase.tag}!`
      );
  }

  let phasePanel: JSX.Element;

  switch (phase.tag) {
    case "reply":
      phasePanel = <AnswerPanelNS.Reply changePhase={changePhase} />;
      break;
    case "confirm":
      phasePanel = (
        <AnswerPanelNS.Confirm
          changeState={changePhase}
          answer={phase.answer}
        />
      );
      break;
    case "confirmed":
      if (props.myReadiness === "blocking" || props.myReadiness === "ready")
        phasePanel = (
          <Confirmed
            changeReadiness={props.changeReadiness}
            myBlockingness={props.myReadiness}
          />
        );
      else phasePanel = <div />;
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
    changePhase: (phase: Phase<boolean>) => void;
  };

  export function Reply(props: ReplyProps): JSX.Element {
    return (
      <div>
        <button
          type="button"
          onClick={() => props.changePhase(Phase.confirm(true))}
        >
          Je réponds OUI!
        </button>
        <button
          type="button"
          onClick={() => props.changePhase(Phase.confirm(false))}
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
}

//////////////////////////////////////////
// Harvest Type = Question

function QuestionPanel(props: {
  sendQuestion(question: string | null): void;
  myReadiness: Member.Readiness | undefined;
  changeReadiness(r: Member.Blockingness): void;
}): JSX.Element {
  const [phase, setPhase] = useState<Phase<string | null>>(
    Phase.initial(props.myReadiness)
  );

  function changePhase(newPhase: Phase<string | null>) {
    if (Phase.change(phase, newPhase, props.sendQuestion)) setPhase(newPhase);
    else
      throw Error(
        `Wrong phase answer transition ${phase.tag} to ${newPhase.tag}!`
      );
  }

  let phasePanel: JSX.Element;

  switch (phase.tag) {
    case "reply":
      phasePanel = <QuestionPanelNS.Reply changePhase={changePhase} />;
      break;
    case "confirm":
      phasePanel = (
        <QuestionPanelNS.Confirm
          changePhase={changePhase}
          question={phase.answer}
        />
      );
      break;
    case "confirmed":
      if (props.myReadiness === "blocking" || props.myReadiness === "ready")
        phasePanel = (
          <Confirmed
            changeReadiness={props.changeReadiness}
            myBlockingness={props.myReadiness}
          />
        );
      else phasePanel = <div />;
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
    changePhase: (phase: Phase<string | null>) => void;
  };

  export function Reply(props: ReplyProps): JSX.Element {
    const [input, setInput] = useState<string>("");

    function ask() {
      props.changePhase(Phase.confirm(input ? input : null));
    }

    function dontAsk() {
      props.changePhase(Phase.confirm(null));
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
}
