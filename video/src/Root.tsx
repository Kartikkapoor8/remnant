import React, { type FC } from "react";
import { Composition } from "remotion";
import { DURATION, Explainer, FPS } from "./Explainer.tsx";

export const Root: FC = () => (
  <Composition id="Explainer" component={Explainer} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
);
