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
            question={props.waiting.question.message}
            sendClosedAnswer={props.sendClosedAnswer}
            myReadiness={myMemberReadiness?.readiness}
            changeReadiness={props.changeReadiness}
          />
        );
        break;
      case "open":
        waitingPanel = (
          <OpenAnswerPanel
            question={props.waiting.question.message}
            sendOpenAnswer={props.sendOpenAnswer}
            myReadiness={myMemberReadiness?.readiness}
            changeReadiness={props.changeReadiness}
          />
        );
    }
  }

  return (
    <section>
      {waitingPanel}
      <ReadinessPanel readiness={props.waiting.ready} name={props.name} />
    </section>
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
    title: string,
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
        <h3>{title}</h3>
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
      return renderOk(
        "Tu bloques la récolte!",
        "Pense à la débloquer un jour.",
        "Je débloque la récolte.",
        "ready"
      );
    case "ready":
      return renderOk(
        "Attends le début de la récolote.",
        "Ton choix est confirmé!",
        "Bloquer la récolote",
        "blocking"
      );
  }
}

//////////////////////////////////////////
// Harvest Type = Closed Answer

namespace ClosedAnswerPanelNS {
  type ReplyProps = {
    question: string;
    changePhase: (phase: Phase<boolean>) => void;
  };

  export function Reply(props: ReplyProps): JSX.Element {
    return (
      <div>
        <h3>Il est temps de répondre!</h3>
        <p>
          La question est: "
          <strong className="the-question">{props.question}</strong>"
        </p>
        <button
          className="yes-no-button"
          type="button"
          onClick={() => props.changePhase(Phase.confirm(true))}
        >
          Je réponds <em className="the-answer">OUI</em>!
        </button>
        <button
          className="yes-no-button"
          type="button"
          onClick={() => props.changePhase(Phase.confirm(false))}
        >
          Je réponds <em className="the-answer">NON</em>!
        </button>
      </div>
    );
  }

  type ConfirmProps = {
    question: string;
    changeState: (phase: Phase<boolean>) => void;
    answer: boolean;
  };

  export function Confirm(props: ConfirmProps): JSX.Element {
    return (
      <div>
        <h3>Confirme ta réponse</h3>
        <p>
          Confirmes tu ton{" "}
          <strong className="the-answer">{props.answer ? "OUI" : "NON"}</strong>{" "}
          à la question "
          <strong className="the-question">{props.question}</strong>" ?
        </p>
        <button
          className="yes-no-button"
          type="button"
          onClick={() => props.changeState(Phase.confirmed)}
        >
          Je confirme mon{" "}
          <em className="the-answer">{props.answer ? "OUI" : "NON"}</em>!
        </button>
        <button
          className="yes-no-button"
          type="button"
          onClick={() => props.changeState(Phase.reply)}
        >
          Je veux changer de réponse.
        </button>
      </div>
    );
  }
}

type ClosedAnswerProps = {
  question: string;
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

  switch (phase.tag) {
    case "reply":
      return (
        <ClosedAnswerPanelNS.Reply
          question={props.question}
          changePhase={changePhase}
        />
      );

    case "confirm":
      return (
        <ClosedAnswerPanelNS.Confirm
          question={props.question}
          changeState={changePhase}
          answer={phase.answer}
        />
      );
    case "confirmed":
      if (props.myReadiness === "blocking" || props.myReadiness === "ready")
        return (
          <Confirmed
            changeReadiness={props.changeReadiness}
            myBlockingness={props.myReadiness}
          />
        );
      else return <div />;
  }
}

//////////////////////////////////////////
// Harvest type = Open Answer

namespace OpenAnswerPanelNS {
  type ReplyProps = {
    question: string;
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
        <h3>Il est temps de répondre!</h3>
        <p>
          La question est: "<em className="the-question">{props.question}</em>"
        </p>
        <textarea
          rows={5}
          cols={60}
          maxLength={Parameters.maxTextSize}
          value={input}
          onChange={change}
          placeholder={"Écrivez ici votre réponse."}
        />
        <div>
          <button className="open-answer-button" type="button" onClick={answer}>
            Je validte ma réponse.
          </button>
        </div>
      </div>
    );
  }

  type ConfirmProps = {
    question: string;
    changeState: (phase: Phase<string>) => void;
    answer: string;
  };

  export function Confirm(props: ConfirmProps): JSX.Element {
    return (
      <div>
        <h3>Confirme ton choix</h3>
        <p>Tu as choisi de répondre :</p>
        <p>
          "<em className="the-answer">{props.answer}</em>"
        </p>

        <p> à la question:</p>

        <p>
          "<strong className="the-question">{props.question}</strong>"
        </p>

        <button
          className="yes-no-button"
          type="button"
          onClick={() => props.changeState(Phase.confirmed)}
        >
          Je confirme ma réponse!
        </button>
        <button
          className="yes-no-button"
          type="button"
          onClick={() => props.changeState(Phase.reply)}
        >
          Je veux revenir en arrière.
        </button>
      </div>
    );
  }
}

type OpenAnswerProps = {
  question: string;
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

  switch (phase.tag) {
    case "reply":
      return (
        <OpenAnswerPanelNS.Reply
          question={props.question}
          changePhase={changePhase}
        />
      );
    case "confirm":
      return (
        <OpenAnswerPanelNS.Confirm
          question={props.question}
          changeState={changePhase}
          answer={phase.answer}
        />
      );
    case "confirmed":
      if (props.myReadiness === "blocking" || props.myReadiness === "ready")
        return (
          <Confirmed
            changeReadiness={props.changeReadiness}
            myBlockingness={props.myReadiness}
          />
        );
      else return <div />;
  }
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

    const setOpen = () => setKind("open");
    const setClosed = () => setKind("closed");

    return (
      <div>
        <h3>Pose une question anonymement!</h3>
        <fieldset>
          <legend>Question ouverte ou fermée?</legend>
          <div onClick={setOpen}>
            <input
              type="radio"
              name="open"
              checked={kind === "open"}
              onChange={() => {}}
            />
            <label>Ouverte: la réponse est libre.</label>
          </div>
          <div onClick={setClosed}>
            <input
              type="radio"
              name="closed"
              checked={kind === "closed"}
              onChange={() => {}}
            />
            <label>
              Fermée: réponse par OUI ou NON <em>uniquement!</em>
            </label>
          </div>
        </fieldset>

        <textarea
          className="question"
          rows={8}
          cols={40}
          maxLength={Parameters.maxTextSize}
          value={input}
          onChange={change}
          placeholder={`Écrivez ici votre question ${French.questionKind(
            kind
          )}.`}
        />

        <div>
          <button className="yes-no-button" type="button" onClick={ask}>
            Valider ma question <em>{French.questionKind(kind)}</em>.
          </button>
          <button className="yes-no-button" type="button" onClick={dontAsk}>
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
        <h3>Confirme ton choix</h3>
        {props.question ? (
          <div>
            <p>
              Tu as choisi de poser la question{" "}
              <strong>{French.questionKind(props.question.kind)}</strong>:
            </p>
            <p className="the-answer">"{props.question.message}"</p>
          </div>
        ) : (
          <p>Tu as choisi de ne pas poser de question.</p>
        )}
        <button
          className="yes-no-button"
          type="button"
          onClick={() => props.changePhase(Phase.confirmed)}
        >
          Je confirme mon choix!
        </button>
        <button
          className="yes-no-button"
          type="button"
          onClick={() => props.changePhase(Phase.reply)}
        >
          Je veux changer mon choix.
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

  switch (phase.tag) {
    case "reply":
      return <QuestionPanelNS.Reply changePhase={changePhase} />;
    case "confirm":
      return (
        <QuestionPanelNS.Confirm
          changePhase={changePhase}
          question={phase.answer}
        />
      );
    case "confirmed":
      if (props.myReadiness === "blocking" || props.myReadiness === "ready")
        return (
          <Confirmed
            changeReadiness={props.changeReadiness}
            myBlockingness={props.myReadiness}
          />
        );
      else return <div />;
  }
}
