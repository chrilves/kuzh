import { useEffect, useState } from "react";
import {
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import Fuse from "../lib/Fuse";
import { withAsync } from "../lib/Utils";
import { AsssemblyInfo } from "../model/assembly/AssembyInfo";
import { Membership } from "../model/Crypto";
import { Operation } from "../model/Operation";
import { Validation } from "../model/Validation";
import { StorageAPI } from "../services/StorageAPI";
import MembershipPanel from "./MembershipPanel";
import { Nickname } from "./Nickname";
import { useTranslation } from "react-i18next";

interface Nav {
  prepare(operation: Operation): void;
  assembly(membership: Membership): void;
}

export default function Menu(
  props: Nav & { storageAPI: StorageAPI }
): JSX.Element {
  const [lastMembership, setlastMembership] = useState<
    Membership | null | undefined
  >(undefined);
  const { t } = useTranslation();

  const fetchLast = withAsync(async () => {
    const last = await props.storageAPI.fetchLastMembership();
    setlastMembership(last);
  });

  useEffect(fetchLast, [props.storageAPI]);

  const nick = ((x) => (x ? x : ""))(props.storageAPI.fetchNickname());

  const clear = () => {
    props.storageAPI.clearPrivateData();
    setlastMembership(null);
  };

  return lastMembership === undefined ? (
    <div />
  ) : (
    <Routes>
      <Route
        path="/"
        element={
          <main>
            <article>
              <h3>{t("What is kuzh ?")}</h3>
              <p>
                <strong>kuzh</strong>{" "}
                {t("allows members of group, called here an")}{" "}
                <em>{t("assembly")}</em>,{" "}
                {t("to ask questions to other members")}{" "}
                <strong>{t("anonymously")}</strong>{" "}
                {t("and reply to these questions")}{" "}
                <strong>{t("anonymously")}</strong>.
              </p>
              {lastMembership && (
                <LastAssembly
                  lastMembership={lastMembership}
                  prepare={props.prepare}
                  assembly={props.assembly}
                  clear={clear}
                />
              )}
              <Create
                prepare={props.prepare}
                assembly={props.assembly}
                nick={nick}
              />
              <Join
                prepare={props.prepare}
                assembly={props.assembly}
                nick={nick}
              />
            </article>
          </main>
        }
      />
      <Route
        path="/assembly/:assemblyIdP"
        element={
          <Wizzard
            prepare={props.prepare}
            assembly={props.assembly}
            lastMembership={lastMembership}
            nick={nick}
          />
        }
      />
      <Route path="*" element={<Lost />} />
    </Routes>
  );
}

function LastAssembly(
  props: Nav & { lastMembership: Membership; clear(): void }
): JSX.Element {
  const { t } = useTranslation();
  return (
    <section id="last-assembly">
      <h2>{t("Going back to the last assembly")}</h2>
      <MembershipPanel membership={props.lastMembership} />
      <button
        className="yes-no-button"
        type="button"
        onClick={() => props.assembly(props.lastMembership)}
      >
        {t("Go back!")}
      </button>
      <button className="yes-no-button" type="button" onClick={props.clear}>
        {t("Clear private data.")}
      </button>
    </section>
  );
}

function Join(props: Nav & { nick: string }): JSX.Element {
  const [assemblyKey, setAssemblyKey] = useState<string>("");
  const [nickname, setNickname] = useState<string>(props.nick);
  const { t } = useTranslation();

  function join() {
    const info = AsssemblyInfo.parseAssemblyURL(assemblyKey);
    if (info !== null)
      props.prepare(Operation.join(info.id, info.name, info.secret, nickname));
    else alert("URL d'assemblée invalide");
  }

  function validInput(): boolean {
    return (
      AsssemblyInfo.parseAssemblyURL(assemblyKey) !== null &&
      !!nickname &&
      !!nickname.trim()
    );
  }

  return (
    <section id="join">
      <h2>{t("Join an existing assembly")}</h2>
      <p>
        {t(
          "To join an existing assembly, type here the assembly link, choose a nickname and have fun!"
        )}
      </p>
      <div className="input-line">
        <label className="half">{t("Full link of the assembly")} : </label>
        <input
          className="half"
          type="text"
          name="assembly_key"
          placeholder={t("assembly url")}
          value={assemblyKey}
          onChange={(e) => setAssemblyKey(e.target.value)}
        />
      </div>
      <Nickname nickname={nickname} setNickname={setNickname} />
      <button
        type="button"
        className="single-button"
        onClick={
          validInput()
            ? join
            : () => alert(t("The information you gave is incorrect, sorry."))
        }
      >
        {t("Join the assembly")}{" "}
        {validInput() ? "" : `(${t("invalid input")}.)`}
      </button>
    </section>
  );
}

function Create(props: Nav & { nick: string }): JSX.Element {
  const { t } = useTranslation();
  const [assemblyName, setAssemblyName] = useState<string>(t("my assembly"));
  const [nickname, setNickname] = useState<string>(props.nick);

  function create() {
    props.prepare(Operation.create(assemblyName, nickname));
  }

  function validInput(): boolean {
    return (
      Validation.nickname(nickname) && Validation.assemblyName(assemblyName)
    );
  }

  return (
    <section id="create">
      <h2>{t("Create a new assembly")}</h2>
      <p>
        {t(
          'Give a name to your new assembly, any one, yes "my assembly" is a good fit! Choose a nickname and have fun!'
        )}
      </p>
      <div className="input-line">
        <label className="half">{t("Give your assembly a name")} : </label>
        <input
          className="half"
          type="text"
          name="assemblyName"
          placeholder={t("the assembly name")}
          value={assemblyName}
          onChange={(e) => setAssemblyName(e.target.value)}
        />
      </div>
      <Nickname nickname={nickname} setNickname={setNickname} />
      <button
        type="button"
        className="single-button"
        onClick={
          validInput()
            ? create
            : () => alert(t("Invalid assembly link or nickname."))
        }
      >
        {t("Create the assembly")}{" "}
        {validInput() ? "" : `(${t("Invalid assembly link or nickname.")})`}
      </button>
    </section>
  );
}

function Wizzard(
  props: Nav & { lastMembership: Membership | null } & { nick: string }
): JSX.Element {
  const { assemblyIdP } = useParams();
  const [fuse] = useState<Fuse>(new Fuse());

  const [URLSearchParams] = useSearchParams();
  const secretQS = URLSearchParams.get("secret");
  const nameQS = URLSearchParams.get("name");

  const [secret, setSecret] = useState<string>(secretQS ? secretQS : "");
  const [nickname, setNickname] = useState<string>(props.nick);
  const navigate = useNavigate();
  const { t } = useTranslation();

  let postAction: (() => void) | undefined = undefined;

  const performPostAction = withAsync(async () => {
    if (postAction && (await fuse.break())) postAction();
  });

  useEffect(performPostAction, [props.lastMembership]);

  let assemblyId: string;
  if (assemblyIdP) {
    assemblyId = assemblyIdP;
  } else {
    return <div />;
  }

  if (props.lastMembership && props.lastMembership.assembly.id === assemblyId) {
    const Membership = props.lastMembership;
    postAction = () => {
      props.assembly(Membership);
    };
    return <div />;
  }

  function join() {
    let refinedSecret: string;
    let refinedName: string | null = null;
    const m = AsssemblyInfo.parseAssemblyURL(secret);
    if (m !== null) {
      refinedSecret = m.secret;
      refinedName = m.name;
    } else {
      refinedSecret = secret;
    }

    if (refinedName === null) {
      refinedName = nameQS;
    }

    props.prepare(
      Operation.join(assemblyId, refinedName, refinedSecret, nickname)
    );
  }

  function validInput(): boolean {
    return Validation.nickname(nickname) && Validation.secret(secret);
  }

  return (
    <main>
      <article>
        <div className="menu-wizard">
          <button type="button" onClick={() => navigate("/")}>
            {t("Menu")}
          </button>
        </div>
        {!secretQS && (
          <div className="input-line">
            <label className="half">
              {t("Full link (URL) of the assembly")}:{" "}
            </label>
            <input
              className="half"
              type="text"
              name="URL"
              placeholder="URL"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </div>
        )}
        <Nickname nickname={nickname} setNickname={setNickname} />
        {validInput() ? (
          <div>
            <button type="button" className="single-button" onClick={join}>
              {t("Join the assembly")}
            </button>
          </div>
        ) : (
          <p>{t("Invalid inputs")}.</p>
        )}
      </article>
    </main>
  );
}

function Lost(): JSX.Element {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <main>
      <article>
        <button type="button" onClick={() => navigate("/")}>
          {t("Menu")}
        </button>
        <p>{t("Oops ... where do you wanted to go ?")}</p>
      </article>
    </main>
  );
}
