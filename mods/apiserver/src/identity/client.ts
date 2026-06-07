import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "node:url";

const PROTO_PATH = fileURLToPath(new URL("./protos/identity.proto", import.meta.url));

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: false,
  arrays: true,
  oneofs: true
});

const proto = grpc.loadPackageDefinition(packageDefinition) as unknown as {
  fonoster: { identity: { v1beta2: { Identity: grpc.ServiceClientConstructor } } };
};

const IdentityService = proto.fonoster.identity.v1beta2.Identity;

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
  avatar?: string;
}

export interface ExchangeCredentialsRequest {
  username: string;
  password: string;
  twoFactorCode?: string;
}

export interface ExchangeResponse {
  idToken?: string;
  accessToken: string;
  refreshToken: string;
}

export interface Workspace {
  ref: string;
  name: string;
  ownerRef: string;
  accessKeyId: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface WorkspaceMember {
  ref: string;
  userRef: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface InviteMemberRequest {
  email: string;
  role: string;
  name?: string;
}

/**
 * Thin typed client for the Fonoster Identity gRPC service — the "SDK" Fonoster
 * does not publish. Wraps the callback-based stubs (generated from the vendored
 * proto) in promises. Authenticated calls accept the caller's `accessKeyId`,
 * forwarded as gRPC metadata.
 */
export class IdentityClient {
  private readonly client: grpc.Client;

  constructor(endpoint: string) {
    this.client = new IdentityService(endpoint, grpc.credentials.createInsecure());
  }

  private unary<TRes>(
    method: string,
    request: object,
    meta: { token?: string; accessKeyId?: string } = {}
  ): Promise<TRes> {
    const metadata = new grpc.Metadata();
    // Identity reads the caller's access token from "token" and the active
    // workspace from "accesskeyid".
    if (meta.token) metadata.set("token", meta.token);
    if (meta.accessKeyId) metadata.set("accesskeyid", meta.accessKeyId);

    // Call the method on the client object so `this` stays bound to it.
    const client = this.client as unknown as Record<
      string,
      (
        req: object,
        md: grpc.Metadata,
        cb: (err: grpc.ServiceError | null, res: TRes) => void
      ) => void
    >;

    return new Promise<TRes>((resolve, reject) => {
      client[method](request, metadata, (err, res) => (err ? reject(err) : resolve(res)));
    });
  }

  getPublicKey(): Promise<{ publicKey: string }> {
    return this.unary("getPublicKey", {});
  }

  createUser(request: CreateUserRequest): Promise<{ ref: string }> {
    return this.unary("createUser", request);
  }

  exchangeCredentials(request: ExchangeCredentialsRequest): Promise<ExchangeResponse> {
    return this.unary("exchangeCredentials", request);
  }

  exchangeRefreshToken(refreshToken: string): Promise<ExchangeResponse> {
    return this.unary("exchangeRefreshToken", { refreshToken });
  }

  createWorkspace(name: string, token: string): Promise<{ ref: string }> {
    return this.unary("createWorkspace", { name }, { token });
  }

  listWorkspaces(token: string): Promise<{ items: Workspace[]; nextPageToken?: string }> {
    return this.unary("listWorkspaces", {}, { token });
  }

  getWorkspace(ref: string, token: string): Promise<Workspace> {
    return this.unary("getWorkspace", { ref }, { token });
  }

  listWorkspaceMembers(
    accessKeyId: string,
    token: string
  ): Promise<{ items: WorkspaceMember[]; nextPageToken?: string }> {
    return this.unary("listWorkspaceMembers", {}, { token, accessKeyId });
  }

  inviteUserToWorkspace(
    request: InviteMemberRequest,
    accessKeyId: string,
    token: string
  ): Promise<{ userRef: string }> {
    return this.unary("inviteUserToWorkspace", request, { token, accessKeyId });
  }

  removeUserFromWorkspace(
    userRef: string,
    accessKeyId: string,
    token: string
  ): Promise<{ userRef: string }> {
    return this.unary("removeUserFromWorkspace", { userRef }, { token, accessKeyId });
  }

  close() {
    this.client.close();
  }
}

export function createIdentityClient(endpoint?: string): IdentityClient {
  return new IdentityClient(endpoint ?? process.env.IDENTITY_SERVICE_ENDPOINT ?? "localhost:50051");
}
