import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/axios';

interface QueueJob {
  id: string;
  urgencyLevel: 'RED' | 'YELLOW' | 'GREEN';
  property: { unitNumber: string; condominium: { name: string } };
}

interface Props {
  cleaner: { id: string; name: string };
  jobs: QueueJob[];
  onClose: () => void;
}

const URGENCY_DOT: Record<string, string> = {
  RED: 'bg-[#E63946]',
  YELLOW: 'bg-[#F4A261]',
  GREEN: 'bg-[#2DC653]',
};

export default function CleanerQueue({ cleaner, jobs: initialJobs, onClose }: Props) {
  const [jobs, setJobs] = useState(initialJobs);
  const [warning, setWarning] = useState('');
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const qc = useQueryClient();

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const reordered = Array.from(jobs);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setJobs(reordered);

    // Check warning: any RED after any GREEN
    let seenGreen = false;
    let warn = '';
    for (const j of reordered) {
      if (j.urgencyLevel === 'GREEN') seenGreen = true;
      if (seenGreen && j.urgencyLevel === 'RED') {
        warn = `⚠️ Apt ${j.property.unitNumber} é URGENTE mas ficará após apts menos urgentes`;
        break;
      }
    }
    setWarning(warn);
  }

  const reorderMutation = useMutation({
    mutationFn: () =>
      api.patch('/assignments/reorder', {
        cleaner_id: cleaner.id,
        ordered_job_ids: jobs.map(j => j.id),
      }),
    onSuccess: res => {
      setEstimatedCost(res.data.estimated_cost_brl);
      qc.invalidateQueries({ queryKey: ['coordinator-dashboard'] });
    },
  });

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800">Fila de {cleaner.name}</h3>
            <p className="text-xs text-gray-500">Arraste para reordenar</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            ×
          </button>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="cleaner-queue">
            {provided => (
              <div
                className="p-3 space-y-2 max-h-80 overflow-y-auto"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {jobs.map((job, index) => (
                  <Draggable key={job.id} draggableId={job.id} index={index}>
                    {prov => (
                      <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200"
                      >
                        <div
                          {...prov.dragHandleProps}
                          className="text-gray-400 cursor-grab"
                        >
                          ⋮⋮
                        </div>
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${URGENCY_DOT[job.urgencyLevel]}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            Apt {job.property.unitNumber}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {job.property.condominium.name}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400">#{index + 1}</span>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {warning && (
          <div className="mx-3 mb-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700">
            {warning}
          </div>
        )}
        {estimatedCost !== null && (
          <div className="mx-3 mb-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
            Custo estimado de transporte: R$ {estimatedCost.toFixed(2)}
          </div>
        )}

        <div className="p-4 pt-0 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => reorderMutation.mutate()}
            disabled={reorderMutation.isPending}
            className="flex-[2] py-2 bg-[#0D7377] text-white rounded-lg text-sm font-semibold hover:bg-[#0B5563] disabled:opacity-50 transition-colors"
          >
            {reorderMutation.isPending ? 'Salvando...' : 'Salvar ordem'}
          </button>
        </div>
      </div>
    </div>
  );
}
