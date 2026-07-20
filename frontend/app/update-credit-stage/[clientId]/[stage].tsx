import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import StageEditor from '@/components/StageEditor';

export default function UpdateCreditStage() {
  const { clientId, stage } = useLocalSearchParams<{ clientId: string; stage: string }>();
  return <StageEditor area="credit" clientId={clientId!} stageKey={stage!} />;
}
