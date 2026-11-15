import React from "react";
import { Composition } from "remotion";
import { HeirloomAd } from "./HeirloomAd";
import { FPS, H, TOTAL, W } from "./theme";

export const Root: React.FC = () => (
  <Composition id="HeirloomDemo" component={HeirloomAd} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
);
