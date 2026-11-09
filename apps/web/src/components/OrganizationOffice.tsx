'use client';

import { Fragment, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import Link from 'next/link';
import { Activity, ArrowUpRight, BookOpen, Bot, Cpu, FolderKanban, Landmark, Scale, ShieldCheck, Users } from 'lucide-react';
import type { Agent } from '@/lib/api/agents';
import type { Department } from '@/lib/api/organizations';
import type { ApprovalRequest, Project, ResourceSummary, Task } from '@/lib/api/controlRoom';
import { AgentAvatar } from '@/components/ui/AgentAvatar';

type OfficeRoom = 'product' | 'intelligence' | 'operations' | 'review';
type TeamRoom = Exclude<OfficeRoom, 'review'>;
type Selection = { type: 'room'; room: OfficeRoom } | { type: 'agent'; id: string };
// `teamRooms` only drives the department rooms that have a geometry entry; the
// 'review' room is rendered separately with fixed coordinates.
const teamRooms: TeamRoom[] = ['product', 'intelligence', 'operations'];

const roomPositions: Record<OfficeRoom, { x: number; y: number }> = {
  product: { x: 438, y: 133 },
  intelligence: { x: 703, y: 177 },
  operations: { x: 304, y: 196 },
  review: { x: 553, y: 254 },
};

const roomCopy: Record<OfficeRoom, { title: string; purpose: string; color: string }> = {
  product: { title: 'Product Lab', purpose: 'Shape useful, coherent product experiences.', color: 'lime' },
  intelligence: { title: 'Intelligence', purpose: 'Research, synthesis, and model evaluation.', color: 'cyan' },
  operations: { title: 'Operations', purpose: 'Keep delivery safe, reliable, and on track.', color: 'violet' },
  review: { title: 'Human Review Suite', purpose: 'People retain approval over consequential actions.', color: 'amber' },
};

const roomGeometry: Record<TeamRoom, { points: string; x: number; y: number; tone: 'lime' | 'cyan' | 'violet' }> = {
  product: { points: '550,48 752,111 550,180 350,118', x: 550, y: 92, tone: 'lime' },
  intelligence: { points: '770,116 960,174 754,244 550,180', x: 780, y: 153, tone: 'cyan' },
  operations: { points: '140,189 348,124 550,180 346,252', x: 270, y: 184, tone: 'violet' },
};

const agentTitle = (agent: Agent) => typeof agent.identity?.title === 'string' ? agent.identity.title : 'AI employee';
const agentProvider = (agent: Agent) => typeof agent.intelligence_config?.provider === 'string' ? agent.intelligence_config.provider : 'Provider unassigned';

interface OrganizationOfficeProps {
  companyName: string;
  departments: Department[];
  agents: Agent[];
  projects: Project[];
  tasks: Task[];
  approvals: ApprovalRequest[];
  providers: Array<{ id: string; name: string; provider: string; status: string }>;
  resources: ResourceSummary;
  memoryItems: number;
  activePolicies: number;
  onOpenGraph: () => void;
}

/** Interactive isometric headquarters. Rooms are org units; provider systems stay outside the workforce. */
export function OrganizationOffice({
  companyName,
  departments,
  agents,
  projects,
  tasks,
  approvals,
  providers,
  resources,
  memoryItems,
  activePolicies,
  onOpenGraph,
}: OrganizationOfficeProps) {
  const [selection, setSelection] = useState<Selection>({ type: 'room', room: 'product' });
  const selectedAgent = selection.type === 'agent' ? agents.find((agent) => agent.id === selection.id) : undefined;
  const selectedRoom = selection.type === 'room' ? selection.room : undefined;
  const departmentByRoom = useMemo(() => new Map(teamRooms.flatMap((room, index) => departments[index] ? [[room, departments[index]] as const] : [])), [departments]);
  const selectedDepartment = selectedRoom && selectedRoom !== 'review' ? departmentByRoom.get(selectedRoom) : undefined;
  const departmentTitle = (room: OfficeRoom) => room === 'review' ? roomCopy.review.title : departmentByRoom.get(room)?.name ?? 'Department';
  const departmentPurpose = (room: OfficeRoom) => room === 'review' ? roomCopy.review.purpose : departmentByRoom.get(room)?.purpose?.trim() || roomCopy[room].purpose;
  const roomAgents = selectedAgent
    ? [selectedAgent]
    : selectedRoom && selectedRoom !== 'review' && selectedDepartment
      ? agents.filter((agent) => agent.department_id === selectedDepartment.id)
      : [];
  const roomTasks = selectedRoom === 'review'
    ? []
    : tasks.filter((task) => roomAgents.some((agent) => agent.id === task.assigned_agent_id));
  const activeApprovals = approvals.filter((approval) => approval.status === 'PENDING');
  const selectedTitle = selectedAgent?.name ?? (selectedRoom ? departmentTitle(selectedRoom) : companyName);
  const selectedPurpose = selectedAgent ? agentTitle(selectedAgent) : selectedRoom ? departmentPurpose(selectedRoom) : 'Organization headquarters';

  const agentRoom = useMemo(() => {
    const byDepartment = new Map<string, OfficeRoom>();
    teamRooms.forEach((room, index) => {
      const department = departments[index];
      if (department) byDepartment.set(department.id, room);
    });
    return (agent: Agent) => byDepartment.get(agent.department_id ?? '');
  }, [departments]);
  const unpicturedTeams = Math.max(0, departments.length - teamRooms.length);
  const unpicturedAgents = agents.filter((agent) => !agentRoom(agent)).length;

  const setRoom = (room: OfficeRoom) => setSelection({ type: 'room', room });
  const roomOptions: OfficeRoom[] = [...teamRooms.filter((room) => departmentByRoom.has(room)), 'review'];
  const onRoomKeyDown = (event: KeyboardEvent<SVGGElement>, room: OfficeRoom) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setRoom(room);
    }
  };
  const onAgentKeyDown = (event: KeyboardEvent<SVGGElement>, agentId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelection({ type: 'agent', id: agentId });
    }
  };

  return (
    <section className="office-hq" aria-labelledby="office-title">
      <div className="office-hq-grain" aria-hidden="true" />
      <header className="office-hq-header">
        <div className="office-hq-heading">
          <div className="office-hq-kicker"><span /> DIGITAL HEADQUARTERS <b>·</b> ORGANIZATION MAP</div>
          <h2 id="office-title">Inside {companyName}</h2>
          <p>Departments are rooms. Agents are employees. Intelligence providers are infrastructure.</p>
        </div>
        <div className="office-header-actions">
          <span className="office-open-pill"><i /> OFFICE OPEN <b>·</b> {agents.length} PEOPLE</span>
          <button type="button" onClick={onOpenGraph} className="office-graph-link">Organization data <ArrowUpRight aria-hidden="true" /></button>
        </div>
      </header>

      <div className="office-hq-layout">
        <div className="office-building" aria-label={`${companyName} isometric office map`}>
          <div className="office-building-toolbar"><span><span className="office-live-dot" /> OPERATING FLOOR</span><span>LEVEL 01 <b>·</b> GOVERNED AUTONOMY</span>{unpicturedTeams > 0 && <span className="office-map-overflow">+{unpicturedTeams} TEAMS IN ORG GRAPH</span>}</div>
          <div className="office-svg-wrap">
              <svg className="office-floorplan" viewBox="0 0 1100 450" role="group" aria-labelledby="office-map-title office-map-desc">
              <title id="office-map-title">Interactive organization office floorplan</title>
              <desc id="office-map-desc">Select a department room or an agent to inspect its organizational records. The first three department records are pictured here; additional teams remain available from Organization data. Model providers are shown in an external service switchboard.</desc>
              <defs>
                <linearGradient id="office-floor" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#24312c" /><stop offset=".54" stopColor="#141c1b" /><stop offset="1" stopColor="#0c1212" /></linearGradient>
                <linearGradient id="office-wall" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#17211e" /><stop offset="1" stopColor="#080c0c" /></linearGradient>
                <linearGradient id="room-product" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a3e635" stopOpacity=".16" /><stop offset="1" stopColor="#263923" stopOpacity=".22" /></linearGradient>
                <linearGradient id="room-intelligence" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#22d3ee" stopOpacity=".16" /><stop offset="1" stopColor="#153038" stopOpacity=".24" /></linearGradient>
                <linearGradient id="room-operations" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a78bfa" stopOpacity=".16" /><stop offset="1" stopColor="#302346" stopOpacity=".23" /></linearGradient>
                <linearGradient id="room-review" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fbbf24" stopOpacity=".18" /><stop offset="1" stopColor="#33291c" stopOpacity=".27" /></linearGradient>
                <radialGradient id="atrium-orb"><stop stopColor="#d9f99d" /><stop offset=".28" stopColor="#84cc16" /><stop offset=".65" stopColor="#0f3b36" /><stop offset="1" stopColor="#071112" /></radialGradient>
                <filter id="office-shadow" x="-25%" y="-20%" width="150%" height="160%"><feDropShadow dx="0" dy="13" stdDeviation="12" floodColor="#000" floodOpacity=".55" /></filter>
                <filter id="office-glow" x="-200%" y="-200%" width="400%" height="400%"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                <pattern id="office-grid" width="32" height="32" patternUnits="userSpaceOnUse" patternTransform="skewY(18)"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="#d9f99d" strokeOpacity=".045" strokeWidth=".8" /></pattern>
              </defs>

              <ellipse cx="550" cy="346" rx="432" ry="42" fill="#000" opacity=".48" filter="url(#office-shadow)" />
              <polygon points="90,182 550,38 1010,176 550,338" fill="url(#office-floor)" stroke="#8aa39a" strokeOpacity=".42" strokeWidth="1.5" />
              <polygon points="90,182 550,338 550,395 90,237" fill="url(#office-wall)" stroke="#34433e" strokeWidth="1" />
              <polygon points="550,338 1010,176 1010,232 550,395" fill="url(#office-wall)" stroke="#34433e" strokeWidth="1" />
              <polygon points="90,182 550,38 1010,176 550,338" fill="url(#office-grid)" opacity=".7" />

              {teamRooms.map((room) => {
                const department = departmentByRoom.get(room);
                if (!department) return null;
                const geometry = roomGeometry[room];
                return <Fragment key={room}>
                  <OfficeRoomShape room={room} title={department.name} points={geometry.points} active={selectedRoom === room} onClick={() => setRoom(room)} onKeyDown={onRoomKeyDown} />
                  <RoomLabel x={geometry.x} y={geometry.y} title={compactRoomTitle(department.name)} meta={`${agents.filter((agent) => agent.department_id === department.id).length} EMPLOYEES`} tone={geometry.tone} />
                </Fragment>;
              })}
              <OfficeRoomShape room="review" title={roomCopy.review.title} points="550,187 748,250 550,322 352,257" active={selectedRoom === 'review'} onClick={() => setRoom('review')} onKeyDown={onRoomKeyDown} />

              <g className="office-furniture" aria-hidden="true">
                <OfficeDesk x={503} y={147} />
                <OfficeDesk x={574} y={137} />
                <OfficeDesk x={814} y={188} />
                <OfficeDesk x={366} y={217} />
                <OfficeDesk x={658} y={225} />
                <path className="office-conference-table" d="M520 282 l35 -12 36 12 -36 12z" />
                <circle className="office-chair" cx="510" cy="281" r="3" />
                <circle className="office-chair" cx="558" cy="266" r="3" />
                <circle className="office-chair" cx="594" cy="282" r="3" />
                <circle className="office-chair" cx="556" cy="300" r="3" />
              </g>

              <g className="office-walkway" aria-hidden="true">
                <path d="M437 138 C480 152 510 171 540 190 S642 210 690 190 S670 235 592 252" />
                <path d="M326 211 C397 230 451 237 511 239" />
                <circle className="office-flow-pulse office-flow-one" r="3" fill="#d9f99d"><animateMotion dur="6s" repeatCount="indefinite" path="M437 138 C480 152 510 171 540 190 S642 210 690 190 S670 235 592 252" /></circle>
                <circle className="office-flow-pulse office-flow-two" r="2.5" fill="#67e8f9"><animateMotion dur="8s" repeatCount="indefinite" path="M326 211 C397 230 451 237 511 239" /></circle>
              </g>

              <RoomLabel x={550} y={260} title="HUMAN REVIEW SUITE" meta={`${activeApprovals.length} APPROVAL GATE${activeApprovals.length === 1 ? '' : 'S'}`} tone="amber" />

              <g className="office-atrium" aria-hidden="true">
                <ellipse cx="550" cy="187" rx="69" ry="25" fill="#081111" stroke="#9de45a" strokeOpacity=".48" />
                <ellipse cx="550" cy="183" rx="48" ry="17" fill="url(#atrium-orb)" stroke="#d9f99d" strokeOpacity=".8" filter="url(#office-glow)" />
                <text x="550" y="187" textAnchor="middle" className="office-atrium-mark">N</text>
                <text x="550" y="222" textAnchor="middle" className="office-atrium-caption">ORGANIZATION CORE</text>
              </g>

              {agents.map((agent, index) => {
                const room = agentRoom(agent);
                if (!room) return null;
                const base = roomPositions[room];
                const sameRoomIndex = agents.slice(0, index).filter((other) => agentRoom(other) === room).length;
                const offsets = [{ x: 0, y: 0 }, { x: 34, y: 16 }, { x: -32, y: 19 }, { x: 8, y: 34 }];
                const position = offsets[sameRoomIndex % offsets.length];
                return (
                  <g key={agent.id} className={`office-agent ${selection.type === 'agent' && selection.id === agent.id ? 'is-selected' : ''}`} role="button" tabIndex={0} aria-label={`${agent.name}, ${agentTitle(agent)}, ${agent.status}. Select employee.`} onClick={() => setSelection({ type: 'agent', id: agent.id })} onKeyDown={(event) => onAgentKeyDown(event, agent.id)} transform={`translate(${base.x + position.x} ${base.y + position.y})`}>
                    <circle className={`office-agent-halo status-${String(agent.status).toLowerCase()}`} r="15" />
                    <circle className="office-agent-token" r="11" />
                    <text className="office-agent-initial" textAnchor="middle" y="3.5">{agent.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('')}</text>
                    <title>{agent.name} · {agentTitle(agent)} · {agent.status}</title>
                  </g>
                );
              })}

              <g className="office-floor-legend" aria-hidden="true">
                <circle cx="184" cy="312" r="4" fill="#a3e635" /><text x="194" y="315">WORKING</text>
                <circle cx="272" cy="312" r="4" fill="#67e8f9" /><text x="282" y="315">AVAILABLE</text>
                <circle cx="369" cy="312" r="4" fill="#fb7185" /><text x="379" y="315">NEEDS ATTENTION</text>
              </g>
            </svg>
          </div>
          <div className="office-room-selector" aria-label="Choose an office room">
            {roomOptions.map((room) => <button key={room} type="button" aria-label={`Select ${departmentTitle(room)}`} aria-pressed={selectedRoom === room} onClick={() => setRoom(room)} className={`office-room-choice room-choice-${room} ${selectedRoom === room ? 'is-active' : ''}`}>
              <i aria-hidden="true" /><span>{departmentTitle(room)}</span><small>{room === 'review' ? activeApprovals.length : agents.filter((agent) => agent.department_id === departmentByRoom.get(room)?.id).length}</small>
            </button>)}
          </div>
          <div className="office-building-footer"><span>FLOOR PLAN <b>01 / 01</b></span><span>{unpicturedAgents > 0 ? `${unpicturedAgents} EMPLOYEES IN OTHER TEAMS · SEE ORGANIZATION DATA` : 'SELECT A ROOM OR EMPLOYEE TO INSPECT'}</span><span>WORKFLOW ROUTES <i className="office-route-key" /></span></div>
        </div>

        <aside className="office-console" aria-label="Organization office inspector">
          <div className="office-console-section">
            <div className="office-console-label">{selectedAgent ? 'EMPLOYEE FILE' : 'ROOM CONSOLE'} <span>01</span></div>
            <div className="office-selected-icon">{selectedAgent ? <Bot aria-hidden="true" /> : selectedRoom === 'review' ? <ShieldCheck aria-hidden="true" /> : <Users aria-hidden="true" />}</div>
            <h3>{selectedTitle}</h3>
            <p className="office-purpose">{selectedPurpose}</p>
            {selectedAgent ? (
              <div className="office-employee-meta"><span className={`office-state-pill state-${String(selectedAgent.status).toLowerCase()}`}><i /> {selectedAgent.status}</span><span>{agentProvider(selectedAgent)}</span></div>
            ) : (
              <div className="office-room-stats">
                <div><span>EMPLOYEES</span><strong>{selectedRoom === 'review' ? 'Human owner' : roomAgents.length}</strong></div>
                <div><span>OPEN WORK</span><strong>{selectedRoom === 'review' ? activeApprovals.length : roomTasks.filter((task) => task.status !== 'COMPLETED').length}</strong></div>
              </div>
            )}
          </div>

          <div className="office-console-section office-people-section">
            <div className="office-console-label">{selectedRoom === 'review' ? 'HUMAN AUTHORITY' : 'PEOPLE IN THIS ROOM'} <span>{selectedRoom === 'review' ? activeApprovals.length : roomAgents.length}</span></div>
            {selectedRoom === 'review' ? (
              <div className="office-review-callout"><ShieldCheck aria-hidden="true" /><span>{activeApprovals.length ? `${activeApprovals.length} action${activeApprovals.length === 1 ? '' : 's'} waiting for human review` : 'No approvals are waiting.'}</span></div>
            ) : roomAgents.length ? (
              <div className="office-person-list">
                {roomAgents.map((agent) => <button type="button" key={agent.id} aria-label={`Inspect ${agent.name}`} onClick={() => setSelection({ type: 'agent', id: agent.id })} className={`office-person ${selection.type === 'agent' && selection.id === agent.id ? 'is-selected' : ''}`}>
                  <AgentAvatar
                    name={agent.name}
                    roleTitle={agentTitle(agent)}
                    departmentName={agent.department_id ? departments.find((d) => d.id === agent.department_id)?.name : undefined}
                    avatarUrl={agent.identity?.avatar_url as string | undefined}
                    status={agent.status}
                    size={28}
                    showStatus={false}
                    className="shrink-0"
                  />
                  <span className="office-person-copy"><strong>{agent.name}</strong><small>{agentTitle(agent)}</small></span>
                  <i className={`office-person-state status-${String(agent.status).toLowerCase()}`} title={agent.status} />
                </button>)}
              </div>
            ) : <p className="office-empty-note">No employee records are assigned to this room.</p>}
          </div>

          <div className="office-provider-switchboard">
            <div className="office-console-label">PROVIDER SWITCHBOARD <Cpu aria-hidden="true" /></div>
            <div className="office-provider-list">
              {providers.slice(0, 3).map((provider) => <div key={provider.id} className="office-provider"><span className={`office-provider-led provider-${provider.status.toLowerCase()}`} /><span>{provider.name}</span><small>{provider.provider}</small></div>)}
            </div>
            <p>Models are connected services, not employees.</p>
          </div>

          <div className="office-organization-services">
            <Link href="/dashboard/memory" className="office-service-link"><BookOpen aria-hidden="true" /><span><strong>MEMORY ARCHIVE</strong><small>{memoryItems} shared records</small></span><ArrowUpRight aria-hidden="true" /></Link>
            <Link href="/dashboard/governance" className="office-service-link"><Landmark aria-hidden="true" /><span><strong>POLICY PERIMETER</strong><small>{activePolicies} active boundaries</small></span><ArrowUpRight aria-hidden="true" /></Link>
            <Link href="/dashboard/decisions" className="office-service-link"><Scale aria-hidden="true" /><span><strong>DECISION ROOM</strong><small>{activeApprovals.length} pending human reviews</small></span><ArrowUpRight aria-hidden="true" /></Link>
          </div>

          <div className="office-capacity">
            <div><span><Activity aria-hidden="true" /> ORGANIZATION CAPACITY</span><strong>{resources.compute_used_pct ?? 0}%</strong></div>
            <div className="office-capacity-track"><i style={{ width: `${Math.max(0, Math.min(100, resources.compute_used_pct ?? 0))}%` }} /></div>
            <small><FolderKanban aria-hidden="true" /> {projects.filter((project) => project.status === 'ACTIVE').length} active projects <b>·</b> ${resources.budget_spent_usd?.toFixed(2) ?? '—'} / ${resources.budget_allocated_usd?.toFixed(0) ?? '—'} budget</small>
          </div>
        </aside>
      </div>
    </section>
  );
}

function OfficeRoomShape({
  room,
  title,
  points,
  active,
  onClick,
  onKeyDown,
}: {
  room: OfficeRoom;
  title: string;
  points: string;
  active: boolean;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<SVGGElement>, room: OfficeRoom) => void;
}) {
  const gradient = room === 'product' ? 'room-product' : room === 'intelligence' ? 'room-intelligence' : room === 'operations' ? 'room-operations' : 'room-review';
  return (
    <g className={`office-room office-room-${room} ${active ? 'is-active' : ''}`} role="button" tabIndex={0} aria-pressed={active} aria-label={`Inspect ${title}`} onClick={onClick} onKeyDown={(event) => onKeyDown(event, room)}>
      <polygon points={points} fill={`url(#${gradient})`} />
      <polygon points={points} className="office-room-outline" />
      <title>{title}</title>
    </g>
  );
}

function compactRoomTitle(title: string) {
  const normalized = title.trim().toUpperCase();
  return normalized.length > 20 ? `${normalized.slice(0, 18)}…` : normalized;
}

function RoomLabel({ x, y, title, meta, tone }: { x: number; y: number; title: string; meta: string; tone: 'lime' | 'cyan' | 'violet' | 'amber' }) {
  return <g className={`office-room-label tone-${tone}`} aria-hidden="true"><text x={x} y={y} textAnchor="middle" className="office-room-title">{title}</text><text x={x} y={y + 13} textAnchor="middle" className="office-room-meta">{meta}</text></g>;
}

function OfficeDesk({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`} className="office-desk"><path d="M0 0 l15 -5 15 5 -15 5z" /><path d="M5 2 v7 M25 2 v7" /><path className="office-monitor" d="M12 -2 l5 -1.7 5 1.7 -5 1.7z" /><circle className="office-chair" cx="15" cy="9" r="3" /></g>;
}
