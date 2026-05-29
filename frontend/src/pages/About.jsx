import DashboardLayout from '../components/Layout/DashboardLayout';

const About = () => {
  const features = [
    {
      title: "Hybrid Database",
      description: "Kombinasi MySQL untuk manajemen data dan Firebase untuk real-time sync.",
      icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
      color: "bg-blue-500"
    },
    {
      title: "Real-time Sync",
      description: "Data ujian dari Android langsung masuk ke Web Admin secara otomatis.",
      icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
      color: "bg-green-500"
    },
    {
      title: "Secure Authentication",
      description: "Proteksi endpoint menggunakan JWT Token untuk keamanan data.",
      icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
      color: "bg-purple-500"
    },
    {
      title: "Modern UI/UX",
      description: "Interface yang responsif dan menarik dengan Tailwind CSS & Animasi halus.",
      icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
      color: "bg-orange-500"
    }
  ];

  const techStack = [
    { name: "React JS", color: "bg-sky-500" },
    { name: "Node.js", color: "bg-green-600" },
    { name: "MySQL", color: "bg-blue-700" },
    { name: "Firebase", color: "bg-orange-500" },
    { name: "Tailwind", color: "bg-teal-500" },
    { name: "Kotlin (App)", color: "bg-purple-600" }
  ];

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto animate-fade-in">
        
        {/* Header Section */}
        <div className="text-center mb-12 animate-slide-up">
          <div className="inline-block p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl mb-6 shadow-inner">
            <svg className="w-16 h-16 text-indigo-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-4">
            About This Project
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Aplikasi Web Admin untuk manajemen sistem Tryout Ujian Online. 
            Terintegrasi dengan Aplikasi Android siswa melalui Firebase & MySQL.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="group bg-white p-8 rounded-3xl shadow-md hover:shadow-2xl border border-gray-100 transition-all duration-300 transform hover:-translate-y-2 animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={`w-14 h-14 rounded-2xl ${feature.color} flex items-center justify-center mb-6 shadow-lg transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Tech Stack Section */}
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 md:p-12 animate-slide-up delay-400">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
            Technology Stack
          </h2>
          
          <div className="flex flex-wrap justify-center gap-4">
            {techStack.map((tech, index) => (
              <div 
                key={index}
                className="flex items-center space-x-3 px-6 py-4 rounded-2xl bg-gray-50 border border-gray-200 hover:border-blue-300 hover:shadow-md hover:bg-white transition-all duration-300 transform hover:scale-105 cursor-default animate-scale-in"
                style={{ animationDelay: `${0.5 + index * 0.1}s` }}
              >
                <div className={`w-3 h-3 rounded-full ${tech.color} shadow-sm`}></div>
                <span className="font-semibold text-gray-700">{tech.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer / Credits */}
        <div className="mt-12 text-center text-gray-500 text-sm animate-fade-in delay-700 pb-8">
          <p>© {new Date().getFullYear()} Tryout App Admin. Created for Educational Purpose.</p>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default About;