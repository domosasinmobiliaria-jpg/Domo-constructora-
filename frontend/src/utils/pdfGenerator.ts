// Generación de PDFs con marca DOMO usando expo-print + templates HTML.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { LOGO_DATA_URI } from '@/constants/logo';
import { colors } from '@/constants/colors';
import {
  creditStages,
  creditStageLabels,
  technicalStages,
  technicalStageLabels,
  stageStatusLabels,
  clientStatusLabels,
  paymentMethodLabels,
  installmentStatusLabels,
} from '@/constants/labels';
import { formatDate, formatDateTime, formatCurrency } from './format';

type Client = any;
type Meta = { responsible?: string; date?: string };

const LOGO_DATA = LOGO_DATA_URI;

function baseStyles(): string {
  return `
    <style>
      * { box-sizing: border-box; }
      body { font-family: 'Helvetica Neue', Arial, sans-serif; color: ${colors.text}; margin: 0; padding: 28px; }
      .header { display: flex; align-items: center; justify-content: space-between;
                border-bottom: 4px solid ${colors.secondary}; padding-bottom: 14px; margin-bottom: 20px; }
      .header img { height: 54px; }
      .header .company { text-align: right; font-size: 11px; color: ${colors.textMuted}; }
      h1 { color: ${colors.primary}; font-size: 20px; margin: 6px 0 2px; }
      h2 { color: ${colors.primary}; font-size: 15px; margin: 22px 0 8px; border-left: 4px solid ${colors.secondary}; padding-left: 8px; }
      .meta { background: #F4F6F9; border-radius: 10px; padding: 12px 14px; font-size: 12px; margin-bottom: 8px; }
      .meta b { color: ${colors.primary}; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
      th { background: ${colors.primary}; color: #fff; text-align: left; padding: 8px; }
      td { border-bottom: 1px solid ${colors.border}; padding: 8px; vertical-align: top; }
      .badge { display: inline-block; padding: 2px 10px; border-radius: 10px; color: #fff; font-size: 11px; }
      .notes { color: ${colors.textMuted}; font-size: 11px; }
      .signatures { display: flex; justify-content: space-around; margin-top: 60px; }
      .sig { text-align: center; width: 40%; }
      .sig .line { border-top: 1px solid ${colors.text}; margin-bottom: 6px; }
      .footer { margin-top: 30px; text-align: center; font-size: 10px; color: ${colors.textMuted}; }
    </style>`;
}

function statusBadge(status?: string): string {
  const map: Record<string, string> = {
    pending: colors.warning,
    in_progress: colors.secondary,
    completed: colors.green,
    paid: colors.green,
    overdue: colors.red,
  };
  const bg = map[status || 'pending'] || colors.warning;
  const label = stageStatusLabels[status || 'pending'] || installmentStatusLabels[status || 'pending'] || status || '';
  return `<span class="badge" style="background:${bg}">${label}</span>`;
}

function header(title: string): string {
  return `
    <div class="header">
      <img src="${LOGO_DATA}" alt="DOMO" />
      <div class="company">
        DOMO Constructora e Inmobiliaria<br/>
        Ambato · Ecuador
      </div>
    </div>
    <h1>${title}</h1>`;
}

function metaBlock(client: Client, meta?: Meta): string {
  return `
    <div class="meta">
      <div><b>Cliente:</b> ${client?.name || '—'}</div>
      <div><b>Teléfono:</b> ${client?.phone || '—'} &nbsp;·&nbsp; <b>Correo:</b> ${client?.email || '—'}</div>
      <div><b>Método de pago:</b> ${paymentMethodLabels[client?.payment_method] || '—'} &nbsp;·&nbsp; <b>Estado:</b> ${clientStatusLabels[client?.status] || '—'}</div>
      ${meta?.responsible ? `<div><b>Responsable:</b> ${meta.responsible}</div>` : ''}
      <div><b>Fecha:</b> ${meta?.date ? formatDate(meta.date) : formatDate(new Date().toISOString())}</div>
    </div>`;
}

function signatures(): string {
  return `
    <div class="signatures">
      <div class="sig"><div class="line"></div>Responsable DOMO</div>
      <div class="sig"><div class="line"></div>Cliente</div>
    </div>
    <div class="footer">Documento generado por la app DOMO Constructora · ${formatDateTime(new Date().toISOString())}</div>`;
}

function stageRow(label: string, stage: any): string {
  return `
    <tr>
      <td><b>${label}</b></td>
      <td>${statusBadge(stage?.status)}</td>
      <td>${stage?.notes ? stage.notes : '<span class="notes">Sin notas</span>'}</td>
      <td class="notes">${stage?.updated_by_name || '—'}<br/>${stage?.updated_at ? formatDateTime(stage.updated_at) : ''}</td>
    </tr>`;
}

async function printAndShare(html: string, filename: string) {
  const { uri } = await Print.printToFileAsync({ html });
  if (Platform.OS === 'web') {
    // En web, expo-print abre el diálogo de impresión/guardado directamente.
    await Print.printAsync({ uri }).catch(() => {});
    return;
  }
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: filename,
      UTI: 'com.adobe.pdf',
    });
  }
}

// PDF de una sola etapa (crédito o técnico).
export async function generateStagePdf(
  area: 'credit' | 'technical',
  client: Client,
  stageKey: string,
  stage: any,
  meta?: Meta
) {
  const label =
    area === 'credit' ? creditStageLabels[stageKey] : technicalStageLabels[stageKey];
  const routeName = area === 'credit' ? 'Ruta de Crédito' : 'Ruta Técnica';
  const html = `<html><head>${baseStyles()}</head><body>
    ${header(`${routeName} — ${label}`)}
    ${metaBlock(client, meta)}
    <table>
      <tr><th>Etapa</th><th>Estado</th><th>Notas</th><th>Última actualización</th></tr>
      ${stageRow(label, stage)}
    </table>
    ${signatures()}
  </body></html>`;
  await printAndShare(html, `${routeName}_${label}.pdf`);
}

// PDF consolidado de toda una ruta (crédito o técnico).
export async function generateRoutePdf(
  area: 'credit' | 'technical',
  client: Client,
  stages: Record<string, any>,
  meta?: Meta
) {
  const keys = area === 'credit' ? creditStages : technicalStages;
  const labels = area === 'credit' ? creditStageLabels : technicalStageLabels;
  const routeName = area === 'credit' ? 'Ruta de Crédito' : 'Ruta Técnica';
  const rows = keys.map((k) => stageRow(labels[k], stages?.[k])).join('');
  const html = `<html><head>${baseStyles()}</head><body>
    ${header(`${routeName} — Consolidado`)}
    ${metaBlock(client, meta)}
    <table>
      <tr><th>Etapa</th><th>Estado</th><th>Notas</th><th>Última actualización</th></tr>
      ${rows}
    </table>
    ${signatures()}
  </body></html>`;
  await printAndShare(html, `${routeName}_consolidado.pdf`);
}

// PDF consolidado del cronograma de obra.
export async function generateConstructionPdf(
  client: Client,
  activities: any[],
  meta?: Meta
) {
  const rows = (activities || [])
    .map(
      (a) => `
      <tr>
        <td><b>${a.name}</b></td>
        <td>${statusBadge(a.status)}</td>
        <td>${a.progress ?? 0}%</td>
        <td class="notes">${formatDate(a.start_date)} → ${formatDate(a.end_date)}</td>
        <td>${a.notes ? a.notes : '<span class="notes">—</span>'}</td>
      </tr>`
    )
    .join('');
  const html = `<html><head>${baseStyles()}</head><body>
    ${header('Cronograma de Obra — Consolidado')}
    ${metaBlock(client, meta)}
    <table>
      <tr><th>Actividad</th><th>Estado</th><th>Progreso</th><th>Fechas</th><th>Notas</th></tr>
      ${rows || '<tr><td colspan="5">Sin actividades registradas</td></tr>'}
    </table>
    ${signatures()}
  </body></html>`;
  await printAndShare(html, 'Cronograma_obra.pdf');
}

// PDF del plan de pagos.
export async function generatePaymentPdf(
  client: Client,
  schedule: any,
  meta?: Meta
) {
  const rows = (schedule?.installments || [])
    .map(
      (i: any) => `
      <tr>
        <td>#${i.number}</td>
        <td>${formatCurrency(i.amount)}</td>
        <td>${formatDate(i.due_date)}</td>
        <td>${statusBadge(i.status)}</td>
        <td class="notes">${i.paid_date ? formatDate(i.paid_date) : '—'}</td>
      </tr>`
    )
    .join('');
  const html = `<html><head>${baseStyles()}</head><body>
    ${header('Plan de Pagos')}
    ${metaBlock(client, meta)}
    <div class="meta">
      <div><b>Subtotal:</b> ${formatCurrency(schedule?.subtotal)} ·
      <b>IVA (${((schedule?.iva_rate || 0) * 100).toFixed(0)}%):</b> ${formatCurrency(schedule?.iva_amount)} ·
      <b>Total:</b> ${formatCurrency(schedule?.total_amount)}</div>
      <div><b>Abono inicial:</b> ${formatCurrency(schedule?.down_payment)} ·
      <b>Cuotas:</b> ${schedule?.num_installments}</div>
    </div>
    <table>
      <tr><th>Cuota</th><th>Monto</th><th>Vencimiento</th><th>Estado</th><th>Fecha de pago</th></tr>
      ${rows || '<tr><td colspan="5">Sin cuotas</td></tr>'}
    </table>
    ${signatures()}
  </body></html>`;
  await printAndShare(html, 'Plan_de_pagos.pdf');
}
