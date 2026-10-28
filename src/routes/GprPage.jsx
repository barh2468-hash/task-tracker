import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import { useProjects } from '../features/projects/ProjectsContext.jsx';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh.js';
import { getOrders, saveOrder, updateOrderProgress } from '../features/gpr/api.js';
import GprWorkspace from '../features/gpr/GprWorkspace.jsx';
import Microsoft365Panel from '../features/gpr/Microsoft365Panel.jsx';
import OrderEmailsPanel from '../features/gpr/OrderEmailsPanel.jsx';
import { orderName } from '../features/gpr/model.js';
import { t } from '../features/language/LanguageContext.jsx';
import { projectDeepLinkPath } from '../utils/navigation.js';

export default function GprPage() {
  const { isAdmin, session } = useAuth();
  const { projects } = useProjects();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [emailConnected, setEmailConnected] = useState(false);
  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setOrders(await getOrders());
      setError('');
    } catch (error) {
      setError(['42P01', 'PGRST205'].includes(error.code) ? 'gpr.setupError' : 'gpr.loadError');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);
  useEffect(() => {
    if (isAdmin) void load();
    else setOrders([]);
  }, [load, isAdmin]);
  useRealtimeRefresh({
    enabled: isAdmin,
    channelName: 'gpr-work-orders',
    tables: ['gpr_work_orders'],
    onRefresh: load,
  });
  if (!isAdmin) return <Navigate to="/app/projects" replace />;
  return (
    <>
      <Microsoft365Panel
        orders={orders}
        onChanged={load}
        onStatus={setEmailConnected}
        result={params.get('m365_result')}
      />
      <GprWorkspace
        orders={orders}
        emailIntakeConnected={emailConnected}
        projects={projects}
        loading={loading}
        error={error}
        onRetry={() => {
          setLoading(true);
          void load();
        }}
        selectedId={params.get('order')}
        onSelect={(id) => setParams(id ? { order: id } : {})}
        onSave={async (form) => {
          const result = await saveOrder(form, session.user.id);
          setOrders((current) => [result, ...current.filter((order) => order.id !== result.id)]);
          return result;
        }}
        onUpdate={async (order, change) => {
          try {
            const row = await updateOrderProgress(order, change);
            setOrders((current) => current.map((item) => (item.id === row.id ? row : item)));
            return row;
          } catch (error) {
            if (error.code === 'PGRST116') void load();
            throw error;
          }
        }}
        renderEmails={(order) => <OrderEmailsPanel key={order.id} order={order} />}
        onOpenProject={(project) => navigate(projectDeepLinkPath(project))}
        onNewProject={(order) =>
          navigate('/app/projects/new', {
            state: {
              gprOrderId: order.id,
              gprUpdatedAt: order.updated_at,
              gprProject: {
                name: orderName(order, t),
                client_name: order.client_name,
                location: order.location,
                description: order.description,
                contact_phone: order.contact_phone,
                contact_email: order.contact_email,
                contacts:
                  order.contact_name || order.contact_phone || order.contact_email
                    ? [
                        {
                          name: order.contact_name,
                          phone: order.contact_phone,
                          email: order.contact_email,
                        },
                      ]
                    : [],
              },
            },
          })
        }
      />
    </>
  );
}
