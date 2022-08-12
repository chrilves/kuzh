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

  const fetchLast = withAsync(async () => {
    const last = await props.storageAPI.fetchLastMembership();
    setlastMembership(last);
  });

  useEffect(fetchLast, [props.storageAPI, fetchLast]);

  const nick = ((x) => (x ? x : ""))(props.storageAPI.fetchNickname());

  return lastMembership === undefined ? (
    <div />
  ) : (
    <Routes>
      <Route
        path="/"
        element={
          <main>
            <article>
              {lastMembership && (
                <LastAssembly
                  lastMembership={lastMembership}
                  prepare={props.prepare}
                  assembly={props.assembly}
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
  props: Nav & { lastMembership: Membership }
): JSX.Element {
  return (
    <section id="last-assembly">
      <h2>Revenir à ta dernière Assemblée</h2>
      <MembershipPanel membership={props.lastMembership} />
      <button
        type="button"
        onClick={() => props.assembly(props.lastMembership)}
      >
        Rejoindre ta dernière Assemblée
      </button>
    </section>
  );
}

function Join(props: Nav & { nick: string }): JSX.Element {
  const [assemblyKey, setAssemblyKey] = useState<string>("");
  const [nickname, setNickname] = useState<string>(props.nick);

  async function join() {
    const info = AsssemblyInfo.parseAssemblyURL(assemblyKey);
    if (info !== null) {
      props.prepare(Operation.join(info.id, info.name, info.secret, nickname));
    } else alert("URL d'assemblée invalide");
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
      <h2>Rejoindre une Assemblée existante</h2>
      <p>
        Pour rejoindre une assemblée existance, entre ici le lien de
        l'assemblée, choisi un pseudo et c'est parti!
      </p>
      <div>
        <label>
          Lien (URL) complet (celui avec "?secret=" dedans) de l'assemblée :{" "}
        </label>
        <input
          type="text"
          name="assembly_key"
          placeholder="url de l'assemblée"
          value={assemblyKey}
          onChange={(e) => setAssemblyKey(e.target.value)}
        />
      </div>
      <Nickname nickname={nickname} setNickname={setNickname} />
      <button
        type="button"
        onClick={
          validInput()
            ? join
            : () => alert("Les données que tu as entrées ne sont pas valides.")
        }
      >
        Rejoindre l'Assemblée{" "}
        {validInput() ? "" : "(Les informations ne sont pas valides.)"}
      </button>
    </section>
  );
}

function Create(props: Nav & { nick: string }): JSX.Element {
  const [assemblyName, setAssemblyName] = useState<string>("mon assemblée");
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
      <h2>Créer une nouvelle Assemblée</h2>
      <p>
        Donne un nom à ton assemblée, n'importe lequel, oui "mon assemblée" fera
        très bien l'affaire! Choisi un pseudo et c'est parti!
      </p>
      <div>
        <label>Choisi un nom pour ton assemblée : </label>
        <input
          type="text"
          name="assemblyName"
          placeholder="nom de l'assemblée"
          value={assemblyName}
          onChange={(e) => setAssemblyName(e.target.value)}
        />
      </div>
      <Nickname nickname={nickname} setNickname={setNickname} />
      <button
        type="button"
        onClick={
          validInput()
            ? create
            : () => alert("Clef d'assemblée ou pseudo invalide.")
        }
      >
        Créer l'Assemblée{" "}
        {validInput() ? "" : "(Clef d'assemblée ou pseudo invalide.)"}
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

  let postAction: (() => void) | undefined = undefined;

  const performPostAction = withAsync(async () => {
    if (postAction && (await fuse.break())) postAction();
  });

  useEffect(performPostAction, [performPostAction]);

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
        <button type="button" onClick={() => navigate("/")}>
          Menu
        </button>
        {!secretQS && (
          <div>
            <label>
              Entre ici le lien (URL) complet de l'assemblée (celui avec
              "?secret=" dedans):{" "}
            </label>
            <input
              type="text"
              name="secret"
              placeholder="secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </div>
        )}
        <Nickname nickname={nickname} setNickname={setNickname} />
        {validInput() ? (
          <div>
            <button type="button" onClick={join}>
              Rejoindre l'assemblée
            </button>
          </div>
        ) : (
          <p>Entrées invalides.</p>
        )}
      </article>
    </main>
  );
}

function Lost(): JSX.Element {
  const navigate = useNavigate();
  return (
    <main>
      <article>
        <button type="button" onClick={() => navigate("/")}>
          Menu
        </button>
        <p>Euh ... tu voulais aller où déja?</p>
      </article>
    </main>
  );
}
