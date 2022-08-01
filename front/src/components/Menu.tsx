import { useEffect, useState } from "react";
import { Membership } from "../model/Crypto";
import MembershipPanel from "./MembershipPanel";
import { withAsync } from "../lib/Utils";
import {
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Operation } from "../model/Operation";
import { StorageAPI } from "../services/StorageAPI";
import Fuse from "../lib/Fuse";

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

  useEffect(
    withAsync(async () => {
      const last = await props.storageAPI.fetchLastMembership();
      setlastMembership(last);
    }),
    []
  );

  const nick = ((x) => (x ? x : ""))(props.storageAPI.fetchNickname());

  return lastMembership === undefined ? (
    <div />
  ) : (
    <Routes>
      <Route
        path="/"
        element={
          <div className="App">
            {lastMembership && (
              <LastAssembly
                lastMembership={lastMembership}
                prepare={props.prepare}
                assembly={props.assembly}
              />
            )}
            <Join
              prepare={props.prepare}
              assembly={props.assembly}
              nick={nick}
            />
            <Create
              prepare={props.prepare}
              assembly={props.assembly}
              nick={nick}
            />
          </div>
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

function Nickname(props: {
  nickname: string;
  setNickname(nickname: string): void;
}): JSX.Element {
  return (
    <div>
      <label>pseudo : </label>
      <input
        type="text"
        name="nickname"
        placeholder="vote pseudo"
        value={props.nickname}
        onChange={(e) => props.setNickname(e.target.value)}
      />
    </div>
  );
}

function LastAssembly(
  props: Nav & { lastMembership: Membership }
): JSX.Element {
  return (
    <div className="kuzh-rejoin-last-assembly">
      <h2 className="kuzh-style-action">Revenir à la dernière Assemblée</h2>
      <MembershipPanel membership={props.lastMembership} />
      <button
        type="button"
        onClick={() => props.assembly(props.lastMembership)}
      >
        Revenir à la dernière Assemblée
      </button>
    </div>
  );
}

function Join(props: Nav & { nick: string }): JSX.Element {
  const [assemblyKey, setAssemblyKey] = useState<string>("");
  const [nickname, setNickname] = useState<string>(props.nick);

  async function join() {
    const re = /.*[/]([^/]+)\?secret=(.*)/;
    const match = assemblyKey.match(re);

    if (match) {
      props.prepare(Operation.join(match[1], match[2], nickname));
    }
  }

  function validInput(): boolean {
    const re = /.*[/]([^/]+)\?secret=(.*)/;
    const match = assemblyKey.match(re);
    return match !== null && !!nickname;
  }

  return (
    <div className="kuzh-join-assembly">
      <h2 className="kuzh-style-action">Rejoindre une Assemblée existante</h2>
      <div>
        <label>URL de l'assemblée : </label>
        <input
          type="text"
          name="assembly_key"
          placeholder="url de l'assemblée"
          value={assemblyKey}
          onChange={(e) => setAssemblyKey(e.target.value)}
        />
      </div>
      <Nickname nickname={nickname} setNickname={setNickname} />
      {validInput() ? (
        <div>
          <button type="button" onClick={join}>
            Rejoindre l'Assemblée
          </button>
        </div>
      ) : (
        <p>Entrées invalide!</p>
      )}
    </div>
  );
}

function Create(props: Nav & { nick: string }): JSX.Element {
  const [assemblyName, setAssemblyName] = useState<string>("asm");
  const [nickname, setNickname] = useState<string>(props.nick);

  function create() {
    props.prepare(Operation.create(assemblyName, nickname));
  }

  function validInput(): boolean {
    return true;
  }

  return (
    <div className="kuzh-create-assembly">
      <h2 className="kuzh-style-action">Créer une nouvelle Assemblée</h2>
      <div>
        <label>assemblée : </label>
        <input
          type="text"
          name="assemblyName"
          placeholder="nom de l'assemblée"
          value={assemblyName}
          onChange={(e) => setAssemblyName(e.target.value)}
        />
      </div>
      <Nickname nickname={nickname} setNickname={setNickname} />
      {validInput() ? (
        <div>
          <button type="button" onClick={create}>
            Créer l'Assemblée
          </button>
        </div>
      ) : (
        <p>Clef d'assemblée ou pseudo invalide.</p>
      )}
    </div>
  );
}

function Wizzard(
  props: Nav & { lastMembership: Membership | null } & { nick: string }
): JSX.Element {
  const { assemblyIdP } = useParams();
  const [fuse] = useState<Fuse>(new Fuse());

  const [URLSearchParams] = useSearchParams();
  const secretQS = URLSearchParams.get("secret");

  const [secret, setSecret] = useState<string>(secretQS ? secretQS : "");
  const [nickname, setNickname] = useState<string>(props.nick);
  const navigate = useNavigate();

  let postAction: (() => void) | undefined = undefined;

  useEffect(
    withAsync(async () => {
      if (postAction && (await fuse.break())) postAction();
    })
  );

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
    const m = secret.match(/https?:[/][/].*[?]secret=(.*)/);
    if (m !== null && m.groups !== null) {
      refinedSecret = m[1];
    } else refinedSecret = secret;

    props.prepare(Operation.join(assemblyId, refinedSecret, nickname));
  }

  function validInput(): boolean {
    return true;
  }

  return (
    <div>
      <button type="button" onClick={() => navigate("/")}>
        Menu
      </button>
      {!secretQS && (
        <div>
          <label>secret : </label>
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
    </div>
  );
}

function Lost(): JSX.Element {
  const navigate = useNavigate();
  return (
    <div>
      <button type="button" onClick={() => navigate("/")}>
        Menu
      </button>
      <p>Euh ... tu voulais aller ou déja?</p>
    </div>
  );
}
