import { ChangeEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  autoConfirm: boolean;
  disableBlocking: boolean;
};

function RenderKindedText(props: {
  txt: string;
  kind: Question.Kind;
}): JSX.Element {
  const { t } = useTranslation();
  const arr = t(props.txt).split("<KIND>");
  return (
    <span>
      {arr[0]} <strong>{t(props.kind)}</strong> {arr[1]}
    </span>
  );
}

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
        autoConfirm={props.autoConfirm}
        disableBlocking={props.disableBlocking}
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
            autoConfirm={props.autoConfirm}
            disableBlocking={props.disableBlocking}
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
            autoConfirm={props.autoConfirm}
            disableBlocking={props.disableBlocking}
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
    f: (a: A) => void,
    autoConfirm: boolean
  ): Phase<A> | null {
    if (
      (autoConfirm === false &&
        oldPhase.tag === "reply" &&
        newPhase.tag === "confirm") ||
      (oldPhase.tag === "confirm" && newPhase.tag === "reply")
    )
      return newPhase;
    else {
      if (
        autoConfirm === true &&
        oldPhase.tag === "reply" &&
        newPhase.tag === "confirm"
      ) {
        f(newPhase.answer);
        return Phase.confirmed;
      } else if (oldPhase.tag === "confirm" && newPhase.tag === "confirmed") {
        f(oldPhase.answer);
        return newPhase;
      } else return null;
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
  disableBlocking: Boolean;
}): JSX.Element {
  const [desired, setDesired] = useState<Member.Blockingness>(
    props.myBlockingness
  );
  const { t } = useTranslation();

  function renderOk(
    title: string,
    msg: string,
    buttonMsg: string,
    other: Member.Blockingness
  ): JSX.Element {
    function flip() {
      const real = props.disableBlocking ? "ready" : other;
      setDesired(real);
      props.changeReadiness(real);
    }

    return (
      <div>
        <h3>{title}</h3>
        <p>{msg}</p>
        {desired === props.myBlockingness && !props.disableBlocking && (
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
        t("You're blocking the harvest!"),
        t("Please do not forget to unblock it."),
        t("I stop blocking the harvest"),
        "ready"
      );
    case "ready":
      return renderOk(
        t("Wait the start of the harvest."),
        t("Your choice is confirmed."),
        t("I want to block the harvest"),
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
    const { t } = useTranslation();

    return (
      <div>
        <h3>{t("Time to answer !")}</h3>
        <p>
          {t("The question is")}: "
          <strong className="the-question">{props.question}</strong>"
        </p>
        <button
          className="yes-no-button"
          type="button"
          onClick={() => props.changePhase(Phase.confirm(true))}
        >
          {t("I answer")} <em className="the-answer">{t("YES")}</em>!
        </button>
        <button
          className="yes-no-button"
          type="button"
          onClick={() => props.changePhase(Phase.confirm(false))}
        >
          {t("I answer")} <em className="the-answer">{t("NO")}</em>!
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
    const { t } = useTranslation();

    return (
      <div>
        <h3>{t("Confirm your answer")}</h3>
        <p>
          {t("Do you confirm answering")}{" "}
          <strong className="the-answer">
            {props.answer ? t("YES") : t("NO")}
          </strong>{" "}
          {t("to the question")} "
          <strong className="the-question">{props.question}</strong>" ?
        </p>
        <button
          className="yes-no-button"
          type="button"
          onClick={() => props.changeState(Phase.confirmed)}
        >
          {t("I confirm answering")}{" "}
          <em className="the-answer">{props.answer ? t("YES") : t("NO")}</em>!
        </button>
        <button
          className="yes-no-button"
          type="button"
          onClick={() => props.changeState(Phase.reply)}
        >
          {t("I want to change my answer")}
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
  autoConfirm: boolean;
  disableBlocking: boolean;
};

function ClosedAnswerPanel(props: ClosedAnswerProps): JSX.Element {
  const [phase, setPhase] = useState<Phase<boolean>>(
    Phase.initial(props.myReadiness)
  );

  useEffect(() => {
    if (
      (props.myReadiness === "blocking" || props.myReadiness === "ready") &&
      phase !== Phase.confirmed
    )
      setPhase(Phase.confirmed);
  }, [props.myReadiness, phase]);

  function changePhase(newPhase: Phase<boolean>) {
    const realNewPhase = Phase.change(
      phase,
      newPhase,
      props.sendClosedAnswer,
      props.autoConfirm
    );
    if (realNewPhase !== null) setPhase(realNewPhase);
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
            disableBlocking={props.disableBlocking}
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
    const { t } = useTranslation();

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
        <h3>{t("Time to answer !")}</h3>
        <p>
          {t("The question is")}: "
          <em className="the-question">{props.question}</em>"
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
            {t("I validate my answer")}
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
    const { t } = useTranslation();

    return (
      <div>
        <h3>{t("Confirm your choice")}</h3>
        <p>{t("You have chosen to answer")} :</p>
        <p>
          "<em className="the-answer">{props.answer}</em>"
        </p>

        <p>{t("to the question")} :</p>

        <p>
          "<strong className="the-question">{props.question}</strong>"
        </p>

        <button
          className="yes-no-button"
          type="button"
          onClick={() => props.changeState(Phase.confirmed)}
        >
          {t("I confirm my answer !")}
        </button>
        <button
          className="yes-no-button"
          type="button"
          onClick={() => props.changeState(Phase.reply)}
        >
          {t("I want to go back")}
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
  autoConfirm: boolean;
  disableBlocking: boolean;
};

function OpenAnswerPanel(props: OpenAnswerProps): JSX.Element {
  const [phase, setPhase] = useState<Phase<string>>(
    Phase.initial(props.myReadiness)
  );

  useEffect(() => {
    if (
      (props.myReadiness === "blocking" || props.myReadiness === "ready") &&
      phase !== Phase.confirmed
    )
      setPhase(Phase.confirmed);
  }, [phase, props.myReadiness]);

  function changePhase(newPhase: Phase<string>) {
    const realNewPhase = Phase.change(
      phase,
      newPhase,
      props.sendOpenAnswer,
      props.autoConfirm
    );
    if (realNewPhase !== null) setPhase(realNewPhase);
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
            disableBlocking={props.disableBlocking}
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
    const { t } = useTranslation();

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
        <h3>{t("Ask a question anonymously !")}</h3>
        <fieldset>
          <legend>{t("An open or closed-ended question ?")}</legend>
          <div onClick={setOpen}>
            <input
              type="radio"
              name="open"
              checked={kind === "open"}
              onChange={() => {}}
            />
            <label>{t("Open-ended: any textual answer")}</label>
          </div>
          <div onClick={setClosed}>
            <input
              type="radio"
              name="closed"
              checked={kind === "closed"}
              onChange={() => {}}
            />
            <label>
              {t("Closed-ended: answer by YES or NO")} <em>{t("only")} !</em>
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
          placeholder={t("Type here your {{kind}} question.", {
            kind: t(Question.kindText(kind)),
          })}
        />

        <div>
          <button className="yes-no-button" type="button" onClick={ask}>
            <RenderKindedText txt="I validate my <KIND> question" kind={kind} />
          </button>
          <button className="yes-no-button" type="button" onClick={dontAsk}>
            {t("I don't ask any question !")}
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
    const { t } = useTranslation();

    return (
      <div>
        <h3>{t("Confirm your choice")}</h3>
        {props.question ? (
          <div>
            <p>
              <RenderKindedText
                txt="You have chosen to ask the <KIND> question"
                kind={props.question.kind}
              />{" "}
              :
            </p>
            <p className="the-answer">"{props.question.message}"</p>
          </div>
        ) : (
          <p>{t("You have chosen not to ask question.")}</p>
        )}
        <button
          className="yes-no-button"
          type="button"
          onClick={() => props.changePhase(Phase.confirmed)}
        >
          {t("I confirm my choice !")}
        </button>
        <button
          className="yes-no-button"
          type="button"
          onClick={() => props.changePhase(Phase.reply)}
        >
          {t("I want to change my choice")}
        </button>
      </div>
    );
  }
}

function QuestionPanel(props: {
  sendQuestion(question: Question | null): void;
  myReadiness: Member.Readiness | undefined;
  changeReadiness(r: Member.Blockingness): void;
  autoConfirm: boolean;
  disableBlocking: boolean;
}): JSX.Element {
  const [phase, setPhase] = useState<Phase<Question | null>>(
    Phase.initial(props.myReadiness)
  );

  useEffect(() => {
    if (
      (props.myReadiness === "blocking" || props.myReadiness === "ready") &&
      phase !== Phase.confirmed
    )
      setPhase(Phase.confirmed);
  }, [phase, props.myReadiness]);

  function changePhase(newPhase: Phase<Question | null>) {
    const realNewPhase = Phase.change(
      phase,
      newPhase,
      props.sendQuestion,
      props.autoConfirm
    );
    if (realNewPhase !== null) setPhase(realNewPhase);
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
            disableBlocking={props.disableBlocking}
          />
        );
      else return <div />;
  }
}
