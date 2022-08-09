import { ChangeEvent, useState } from "react";
import { French } from "../French";
import { JSONNormalizedStringifyD } from "../lib/JSONNormalizedStringify";
import { Status } from "../model/assembly/Status";
import { Fingerprint, Name } from "../model/Crypto";
import { Member } from "../model/Member";
import { Parameters } from "../model/Parameters";
import { Question } from "../model/Question";
import ReadinessPanel from "./ReadinessPanel";

type Props = {
  myFingerprint: Fingerprint;
  waiting: Status.Waiting;
  sendClosedAnswer(answer: boolean): void;
  sendOpenAnswer(answer: string): void;
  sendQuestion(question: Question | null): void;
  changeReadiness(r: Member.Blockingness): void;
  name(member: Fingerprint): Promise<Name>;
};

export default function WaitingPanel(props: Props): JSX.Element {
  let waitingPanel: JSX.Element;

  const myMemberReadiness = props.waiting.ready.find(
    (x) => x.member === props.myFingerprint
  );

  if (props.waiting.question === null)
    waitingPanel = (
      <QuestionPanel
        sendQuestion={props.sendQuestion}
        myReadiness={myMemberReadiness?.readiness}
        changeReadiness={props.changeReadiness}
      />
    );
  else {
    switch (props.waiting.question.kind) {
      case "closed":
        waitingPanel = (
          <ClosedAnswerPanel
            question={props.waiting.question}
            sendClosedAnswer={props.sendClosedAnswer}
            myReadiness={myMemberReadiness?.readiness}
            changeReadiness={props.changeReadiness}
          />
        );
        break;
      case "open":
        waitingPanel = (
          <OpenAnswerPanel
            question={props.waiting.question}
            sendOpenAnswer={props.sendOpenAnswer}
            myReadiness={myMemberReadiness?.readiness}
            changeReadiness={props.changeReadiness}
          />
        );
    }
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
// Harvest Type = Closed Answer

namespace ClosedAnswerPanelNS {
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

type ClosedAnswerProps = {
  question: Question;
  sendClosedAnswer(answer: boolean): void;
  myReadiness: Member.Readiness | undefined;
  changeReadiness(r: Member.Blockingness): void;
};

function ClosedAnswerPanel(props: ClosedAnswerProps): JSX.Element {
  const [phase, setPhase] = useState<Phase<boolean>>(
    Phase.initial(props.myReadiness)
  );

  function changePhase(newPhase: Phase<boolean>) {
    if (Phase.change(phase, newPhase, props.sendClosedAnswer))
      setPhase(newPhase);
    else
      throw Error(
        `Wrong phase answer transition ${phase.tag} to ${newPhase.tag}!`
      );
  }

  let phasePanel: JSX.Element;

  switch (phase.tag) {
    case "reply":
      phasePanel = <ClosedAnswerPanelNS.Reply changePhase={changePhase} />;
      break;
    case "confirm":
      phasePanel = (
        <ClosedAnswerPanelNS.Confirm
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
      <h3>Il est temps de répondre!</h3>
      <p>
        La question {French.questionKind(props.question.kind)} est: "
        <span className="question">{props.question.message}</span>"
      </p>
      {phasePanel}
    </div>
  );
}

//////////////////////////////////////////
// Harvest type = Open Answer

namespace OpenAnswerPanelNS {
  type ReplyProps = {
    changePhase: (phase: Phase<string>) => void;
  };

  export function Reply(props: ReplyProps): JSX.Element {
    const [input, setInput] = useState<string>("");

    function answer() {
      if (input.trim().length > 0) props.changePhase(Phase.confirm(input));
    }

    function change(event: ChangeEvent<HTMLTextAreaElement>): void {
      const s = event.target.value;
      if (JSONNormalizedStringifyD(s).length <= Parameters.maxTextSize)
        setInput(s);
    }

    return (
      <div>
        <textarea
          rows={5}
          cols={60}
          maxLength={Parameters.maxTextSize}
          value={input}
          onChange={change}
        />
        <div>
          <button type="button" onClick={answer}>
            Valider ma reponse.
          </button>
        </div>
      </div>
    );
  }

  type ConfirmProps = {
    changeState: (phase: Phase<string>) => void;
    answer: string;
  };

  export function Confirm(props: ConfirmProps): JSX.Element {
    return (
      <div>
        <p>
          Vous avez choisi de répondre : "
          <span className="answer">{props.answer}</span>".
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

type OpenAnswerProps = {
  question: Question;
  sendOpenAnswer(answer: string): void;
  myReadiness: Member.Readiness | undefined;
  changeReadiness(r: Member.Blockingness): void;
};

function OpenAnswerPanel(props: OpenAnswerProps): JSX.Element {
  const [phase, setPhase] = useState<Phase<string>>(
    Phase.initial(props.myReadiness)
  );

  function changePhase(newPhase: Phase<string>) {
    if (Phase.change(phase, newPhase, props.sendOpenAnswer)) setPhase(newPhase);
    else
      throw Error(
        `Wrong phase answer transition ${phase.tag} to ${newPhase.tag}!`
      );
  }

  let phasePanel: JSX.Element;

  switch (phase.tag) {
    case "reply":
      phasePanel = <OpenAnswerPanelNS.Reply changePhase={changePhase} />;
      break;
    case "confirm":
      phasePanel = (
        <OpenAnswerPanelNS.Confirm
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
      <h3>Il est temps de répondre!</h3>
      <p>
        La question {French.questionKind(props.question.kind)} est: "
        <span className="question">{props.question.message}</span>"
      </p>
      {phasePanel}
    </div>
  );
}

//////////////////////////////////////////
// Harvest Type = Question

namespace QuestionPanelNS {
  type ReplyProps = {
    changePhase: (phase: Phase<Question | null>) => void;
  };

  export function Reply(props: ReplyProps): JSX.Element {
    const [input, setInput] = useState<string>("");
    const [kind, setKind] = useState<Question.Kind>("closed");

    function ask() {
      props.changePhase(
        Phase.confirm(input.trim() ? Question.apply(input.trim(), kind) : null)
      );
    }

    function dontAsk() {
      props.changePhase(Phase.confirm(null));
    }

    function change(event: ChangeEvent<HTMLTextAreaElement>): void {
      const s = event.target.value;
      if (JSONNormalizedStringifyD(s).length <= Parameters.maxTextSize)
        setInput(s);
    }

    let questionKindPanel: JSX.Element;
    switch (kind) {
      case "closed":
        questionKindPanel = (
          <div>
            <p>
              Vous posez une question fermée (réponse par OUI ou NON
              uniquement!)
            </p>
            <button type="button" onClick={() => setKind("open")}>
              Non! Ma question est ouverte (réponse libre!)!
            </button>
          </div>
        );
        break;
      case "open":
        questionKindPanel = (
          <div>
            <p>Vous posez une question ouverte (réponse libre!)</p>
            <button type="button" onClick={() => setKind("closed")}>
              Non! Ma question est fermée (réponse par OUI ou NON uniquement)!
            </button>
          </div>
        );
    }

    return (
      <div>
        {questionKindPanel}
        <textarea
          rows={5}
          cols={60}
          maxLength={Parameters.maxTextSize}
          value={input}
          onChange={change}
        />
        <div>
          <button type="button" onClick={ask}>
            Valider ma question.
          </button>
          <button type="button" onClick={dontAsk}>
            Je ne pose aucune question!
          </button>
        </div>
      </div>
    );
  }

  type ConfirmProps = {
    changePhase: (phase: Phase<Question | null>) => void;
    question: Question | null;
  };

  export function Confirm(props: ConfirmProps): JSX.Element {
    return (
      <div>
        {props.question ? (
          <p>
            Vous avez choisi de poser une question{" "}
            {props.question.kind === "closed"
              ? "férmée (reponse par OUI ou NON uniquement)"
              : "ouverte (réponse libre)"}
            : <br />"<span className="question">{props.question.message}</span>"
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

function QuestionPanel(props: {
  sendQuestion(question: Question | null): void;
  myReadiness: Member.Readiness | undefined;
  changeReadiness(r: Member.Blockingness): void;
}): JSX.Element {
  const [phase, setPhase] = useState<Phase<Question | null>>(
    Phase.initial(props.myReadiness)
  );

  function changePhase(newPhase: Phase<Question | null>) {
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
      <h3>Pose une question anonymement!</h3>
      {phasePanel}
    </div>
  );
}
