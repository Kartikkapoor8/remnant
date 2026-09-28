import React, { type FC } from "react";
import { Composition } from "remotion";
import { DURATION, Explainer, FPS } from "./Explainer.tsx";
import { COLD_OPEN_DURATION, ColdOpen, END_CARD_DURATION, EndCard, ExplainerPortrait, PORTRAIT_DURATION } from "./LinkedIn.tsx";

export const Root: FC = () => (
  <>
    <Composition id="Explainer" component={Explainer} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
    <Composition id="ColdOpen169" component={ColdOpen} durationInFrames={COLD_OPEN_DURATION} fps={FPS} width={1920} height={1080} />
    <Composition id="ColdOpen45" component={ColdOpen} durationInFrames={COLD_OPEN_DURATION} fps={FPS} width={1080} height={1350} />
    <Composition id="EndCard169" component={EndCard} durationInFrames={END_CARD_DURATION} fps={FPS} width={1920} height={1080} />
    <Composition id="EndCard45" component={EndCard} durationInFrames={END_CARD_DURATION} fps={FPS} width={1080} height={1350} />
    <Composition id="ExplainerPortrait" component={ExplainerPortrait} durationInFrames={PORTRAIT_DURATION} fps={FPS} width={1080} height={1350} />
  </>
);
