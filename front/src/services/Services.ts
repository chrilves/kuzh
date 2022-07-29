import { AssemblyAPI } from "./AssemblyAPI";
import { IdentityProofStoreFactory } from "./IdentityProofStore";
import { StorageAPI } from "./StorageAPI";

export type Services = {
  storageAPI: StorageAPI;
  assemblyAPI: AssemblyAPI;
  identityProofStoreFactory: IdentityProofStoreFactory;
};
