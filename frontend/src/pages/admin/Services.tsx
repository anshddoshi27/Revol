/**
 * Admin Services Management Page
 * 
 * Interface for business owners to manage their services,
 * pricing, and availability settings.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Search,
  Filter,
  DollarSign,
  Clock,
  Users,
  Settings,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { getServices, toggleServiceStatus as toggleServiceStatusApi, deleteService as deleteServiceApi, getCategories } from '../../api/services/serviceApi';

interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  duration: number; // in minutes
  price: number;
  isActive: boolean;
  maxBookingsPerSlot: number;
  requiresStaff: boolean;
  staffMembers: string[];
  createdAt: string;
  updatedAt: string;
}

const AdminServices: React.FC = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    filterServices();
  }, [services, searchTerm, categoryFilter, statusFilter]);

  const loadServices = async () => {
    try {
      // Load services from real API with current filters
      const filters = {
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        isActive: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
        search: searchTerm || undefined,
        page: 1,
        limit: 50
      };

      const response = await getServices(filters);
      setServices(response.services);
    } catch (error) {
      console.error('Failed to load services:', error);
      // Fallback to mock data if API fails
      const mockServices: Service[] = [
        {
          id: '1',
          name: 'Haircut & Style',
          description: 'Professional haircut with styling and blow-dry',
          category: 'Hair Services',
          duration: 60,
          price: 75,
          isActive: true,
          maxBookingsPerSlot: 1,
          requiresStaff: true,
          staffMembers: ['Emma Wilson', 'Alex Rodriguez'],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-10T00:00:00Z'
        },
        {
          id: '2',
          name: 'Beard Trim',
          description: 'Professional beard trimming and shaping',
          category: 'Grooming',
          duration: 30,
          price: 25,
          isActive: true,
          maxBookingsPerSlot: 2,
          requiresStaff: true,
          staffMembers: ['Alex Rodriguez'],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-05T00:00:00Z'
        },
        {
          id: '3',
          name: 'Color Treatment',
          description: 'Full hair coloring service with consultation',
          category: 'Hair Services',
          duration: 120,
          price: 120,
          isActive: true,
          maxBookingsPerSlot: 1,
          requiresStaff: true,
          staffMembers: ['Emma Wilson'],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-08T00:00:00Z'
        },
        {
          id: '4',
          name: 'Hair Wash & Blow Dry',
          description: 'Professional hair washing and styling',
          category: 'Hair Services',
          duration: 45,
          price: 45,
          isActive: false,
          maxBookingsPerSlot: 2,
          requiresStaff: true,
          staffMembers: ['Emma Wilson', 'Alex Rodriguez'],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-12T00:00:00Z'
        }
      ];

      setServices(mockServices);
    } finally {
      setLoading(false);
    }
  };

  const filterServices = () => {
    let filtered = [...services];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(service =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(service => service.category === categoryFilter);
    }

    // Status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(service => service.isActive);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(service => !service.isActive);
    }

    setFilteredServices(filtered);
  };

  const toggleServiceStatus = async (serviceId: string) => {
    try {
      // Toggle service status via real API
      await toggleServiceStatusApi(serviceId);
      
      // Update local state
      setServices(prev => prev.map(service =>
        service.id === serviceId ? { ...service, isActive: !service.isActive } : service
      ));
    } catch (error) {
      console.error('Failed to toggle service status:', error);
    }
  };

  const deleteService = async (serviceId: string) => {
    if (window.confirm('Are you sure you want to delete this service? This action cannot be undone.')) {
      try {
        // Delete service via real API
        await deleteServiceApi(serviceId);
        
        // Update local state
        setServices(prev => prev.filter(service => service.id !== serviceId));
      } catch (error) {
        console.error('Failed to delete service:', error);
      }
    }
  };

  const getCategories = () => {
    const categories = [...new Set(services.map(service => service.category))];
    return categories;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${mins}m`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Services Management</h1>
              <p className="text-gray-600">Manage your services, pricing, and availability settings.</p>
            </div>
            <button
              onClick={() => navigate('/admin/services/new')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Service
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search services..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                {getCategories().map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              {/* Results Count */}
              <div className="flex items-center text-sm text-gray-600">
                <Filter className="h-4 w-4 mr-2" />
                {filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <div key={service.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{service.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{service.category}</p>
                    <p className="text-sm text-gray-500 line-clamp-2">{service.description}</p>
                  </div>
                  <div className="flex items-center ml-4">
                    {service.isActive ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <DollarSign className="h-4 w-4 mr-2" />
                    <span className="font-medium">{formatCurrency(service.price)}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2" />
                    <span>{formatDuration(service.duration)}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="h-4 w-4 mr-2" />
                    <span>{service.maxBookingsPerSlot} booking{service.maxBookingsPerSlot !== 1 ? 's' : ''} per slot</span>
                  </div>
                </div>

                {service.staffMembers.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-1">Staff Members:</p>
                    <div className="flex flex-wrap gap-1">
                      {service.staffMembers.map((staff, index) => (
                        <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                          {staff}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex space-x-2">
                  <button
                    onClick={() => navigate(`/admin/services/${service.id}`)}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </button>
                  <button
                    onClick={() => navigate(`/admin/services/${service.id}/edit`)}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => toggleServiceStatus(service.id)}
                    className={`px-3 py-2 border shadow-sm text-sm font-medium rounded-md ${
                      service.isActive
                        ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                        : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                    }`}
                  >
                    {service.isActive ? (
                      <>
                        <XCircle className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => deleteService(service.id)}
                    className="px-3 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredServices.length === 0 && (
          <div className="text-center py-12">
            <Settings className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No services found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || categoryFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your filters to see more services.'
                : 'Get started by creating your first service.'}
            </p>
            {!searchTerm && categoryFilter === 'all' && statusFilter === 'all' && (
              <div className="mt-6">
                <button
                  onClick={() => navigate('/admin/services/new')}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Service
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminServices;

