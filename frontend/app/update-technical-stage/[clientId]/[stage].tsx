import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import StageEditor from '@/components/StageEditor';

export default function UpdateTechnicalStage() {
  const { clientId, stage } = useLocalSearchParams<{ clientId: string; stage: string }>();
  return <StageEditor area="technical" clientId={clientId!} stageKey={stage!} />;
}
