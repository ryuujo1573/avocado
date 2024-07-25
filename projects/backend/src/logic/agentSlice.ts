import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type AgentState = {
  //
};

const initialState: AgentState = {
  //
};

export const agentSlice = createSlice({
  name: "agent",
  initialState,
  reducers: {
    auth(state, { payload }: PayloadAction<AuthPayload>) {},
  },
});
